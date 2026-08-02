import { monitorEventLoopDelay } from "node:perf_hooks";
import {
  capacityTelemetryEnabled,
  createCapacityTelemetry,
} from "./capacity-telemetry.js";
import { logInfo, logWarn } from "./logger.js";
import { boundedRuntimeInterval } from "./runtime-interval.js";

const DEFAULT_CAPACITY_FLUSH_INTERVAL_MS = 5 * 60 * 1_000;
const MINIMUM_CAPACITY_FLUSH_INTERVAL_MS = 60_000;

function eventLoopMilliseconds(histogram) {
  const toMilliseconds = (nanoseconds) => {
    const value = Number(nanoseconds);
    return Number.isFinite(value) ? value / 1_000_000 : 0;
  };
  return {
    meanMs: toMilliseconds(histogram.mean),
    maxMs: toMilliseconds(histogram.max),
    p95Ms: toMilliseconds(histogram.percentile(95)),
    p99Ms: toMilliseconds(histogram.percentile(99)),
  };
}

export function startCapacityRuntime({
  role,
  pool = null,
  environment = process.env,
  emit = (snapshot) => logInfo("capacity.aggregate", snapshot),
  beforeFlush = null,
  onError = (error) => logWarn("capacity.aggregate_failed", { error }),
  intervalMs = Number(environment.RIVT_CAPACITY_TELEMETRY_INTERVAL_MS ?? DEFAULT_CAPACITY_FLUSH_INTERVAL_MS),
} = {}) {
  if (!capacityTelemetryEnabled(environment)) {
    return {
      enabled: false,
      telemetry: null,
      async flush() {
        return null;
      },
      async stop() {},
    };
  }
  const interval = boundedRuntimeInterval(intervalMs, {
    name: "RIVT_CAPACITY_TELEMETRY_INTERVAL_MS",
    fallback: DEFAULT_CAPACITY_FLUSH_INTERVAL_MS,
    minimum: MINIMUM_CAPACITY_FLUSH_INTERVAL_MS,
    maximum: 24 * 60 * 60 * 1_000,
  });
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  const telemetry = createCapacityTelemetry({
    role,
    pool,
    eventLoopStats: () => eventLoopMilliseconds(histogram),
  });
  let stopped = false;
  let flushing = null;

  const flush = () => {
    if (flushing) return flushing;
    flushing = Promise.resolve()
      .then(async () => {
        if (typeof beforeFlush === "function") {
          const sample = await beforeFlush();
          if (sample?.workerBacklog) telemetry.recordWorkerBacklog(sample.workerBacklog);
        }
        const snapshot = telemetry.snapshot({ reset: true });
        emit(snapshot);
        histogram.reset();
        return snapshot;
      })
      .finally(() => {
        flushing = null;
      });
    return flushing;
  };

  const timer = setInterval(() => {
    if (!stopped) void flush().catch(onError);
  }, interval);
  timer.unref?.();

  return {
    enabled: true,
    telemetry,
    flush,
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      try {
        await flushing?.catch(onError);
        await flush().catch(onError);
      } finally {
        histogram.disable();
      }
    },
  };
}

export const capacityRuntimeInternals = {
  DEFAULT_CAPACITY_FLUSH_INTERVAL_MS,
  MINIMUM_CAPACITY_FLUSH_INTERVAL_MS,
  eventLoopMilliseconds,
};
