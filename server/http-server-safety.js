export const DEFAULT_HTTP_SERVER_TIMEOUTS = Object.freeze({
  requestTimeoutMs: 120_000,
  headersTimeoutMs: 15_000,
  keepAliveTimeoutMs: 5_000,
  maxHeadersCount: 100,
  maxRequestsPerSocket: 1_000,
  shutdownTimeoutMs: 10_000,
});

function requirePositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
  return value;
}

export function serviceHealthReady({ dependenciesOk, authSecurityOk, migrationState }) {
  return dependenciesOk === true
    && authSecurityOk === true
    && migrationState === "ready";
}

async function runDependencyProbe(probe, timeoutMs) {
  if (typeof probe !== "function") return false;

  const controller = new AbortController();
  let timeoutId;
  const operation = Promise.resolve().then(() => probe(controller.signal));
  // A provider that ignores abort may settle after the bounded health response.
  // Attach a handler now so a later rejection cannot become unhandled.
  operation.catch(() => {});
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error("Dependency health probe timed out."));
    }, timeoutMs);
  });

  try {
    await Promise.race([operation, timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createDependencyHealthProbe({
  databaseConfigured,
  objectStorageConfigured,
  probeDatabase,
  probeObjectStorage,
  timeoutMs = 2_500,
  successCacheTtlMs = 30_000,
  failureCacheTtlMs = 5_000,
  live = true,
  now = Date.now,
  onProbe = null,
} = {}) {
  const probeTimeoutMs = requirePositiveInteger(timeoutMs, "timeoutMs");
  const successTtlMs = requirePositiveInteger(successCacheTtlMs, "successCacheTtlMs");
  const failureTtlMs = requirePositiveInteger(failureCacheTtlMs, "failureCacheTtlMs");
  if (typeof now !== "function") {
    throw new TypeError("now must be a function.");
  }

  let cached = null;
  let inFlight = null;

  async function checkDependencies() {
    const startedAt = now();
    if (!live) {
      return {
        ok: databaseConfigured === true && objectStorageConfigured === true,
        live: false,
        database: databaseConfigured === true ? "postgres" : "missing",
        objectStorage: objectStorageConfigured === true ? "s3-compatible" : "missing",
      };
    }

    const [databaseReady, objectStorageReady] = await Promise.all([
      databaseConfigured === true
        ? runDependencyProbe(probeDatabase, probeTimeoutMs)
        : false,
      objectStorageConfigured === true
        ? runDependencyProbe(probeObjectStorage, probeTimeoutMs)
        : false,
    ]);
    const value = {
      ok: databaseReady && objectStorageReady,
      live: true,
      database: databaseConfigured !== true
        ? "missing"
        : databaseReady ? "postgres" : "unavailable",
      objectStorage: objectStorageConfigured !== true
        ? "missing"
        : objectStorageReady ? "s3-compatible" : "unavailable",
    };
    try {
      onProbe?.({
        databaseOk: databaseReady,
        objectStorageOk: objectStorageReady,
        durationMs: Math.max(0, now() - startedAt),
      });
    } catch {
      // Telemetry must never change dependency health behavior.
    }
    cached = {
      value,
      expiresAt: now() + (value.ok ? successTtlMs : failureTtlMs),
    };
    return value;
  }

  return async function dependencyHealth() {
    if (cached && now() < cached.expiresAt) {
      return cached.value;
    }
    inFlight ??= checkDependencies().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}

export function configureHttpServer(server, {
  requestTimeoutMs = DEFAULT_HTTP_SERVER_TIMEOUTS.requestTimeoutMs,
  headersTimeoutMs = DEFAULT_HTTP_SERVER_TIMEOUTS.headersTimeoutMs,
  keepAliveTimeoutMs = DEFAULT_HTTP_SERVER_TIMEOUTS.keepAliveTimeoutMs,
  maxHeadersCount = DEFAULT_HTTP_SERVER_TIMEOUTS.maxHeadersCount,
  maxRequestsPerSocket = DEFAULT_HTTP_SERVER_TIMEOUTS.maxRequestsPerSocket,
} = {}) {
  if (!server) {
    throw new TypeError("An HTTP server is required.");
  }

  const requestTimeout = requirePositiveInteger(requestTimeoutMs, "requestTimeoutMs");
  const headersTimeout = requirePositiveInteger(headersTimeoutMs, "headersTimeoutMs");
  const keepAliveTimeout = requirePositiveInteger(keepAliveTimeoutMs, "keepAliveTimeoutMs");
  const boundedHeadersCount = requirePositiveInteger(maxHeadersCount, "maxHeadersCount");
  const boundedRequestsPerSocket = requirePositiveInteger(maxRequestsPerSocket, "maxRequestsPerSocket");
  if (headersTimeout > requestTimeout) {
    throw new RangeError("headersTimeoutMs cannot exceed requestTimeoutMs.");
  }

  server.requestTimeout = requestTimeout;
  server.headersTimeout = headersTimeout;
  server.keepAliveTimeout = keepAliveTimeout;
  server.maxHeadersCount = boundedHeadersCount;
  server.maxRequestsPerSocket = boundedRequestsPerSocket;
  return server;
}

export function createGracefulShutdown({
  getServer,
  closeResources,
  timeoutMs = DEFAULT_HTTP_SERVER_TIMEOUTS.shutdownTimeoutMs,
}) {
  if (typeof getServer !== "function") {
    throw new TypeError("getServer must be a function.");
  }
  if (typeof closeResources !== "function") {
    throw new TypeError("closeResources must be a function.");
  }
  const shutdownTimeout = requirePositiveInteger(timeoutMs, "timeoutMs");
  let shutdownPromise = null;
  let resourcesPromise = null;

  const closeResourcesOnce = () => {
    resourcesPromise ??= Promise.resolve().then(closeResources);
    return resourcesPromise;
  };

  return function shutdown(signal = "shutdown") {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = new Promise((resolve, reject) => {
      const server = getServer();
      let settled = false;

      const finish = (error, forced) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        if (error) {
          reject(error);
          return;
        }
        resolve({ forced, signal });
      };

      const finishGracefully = (serverError = null) => {
        void closeResourcesOnce()
          .then(() => finish(serverError, false))
          .catch((error) => finish(error, false));
      };

      const deadline = setTimeout(() => {
        server?.closeAllConnections?.();
        void closeResourcesOnce().catch(() => {});
        finish(null, true);
      }, shutdownTimeout);
      deadline.unref?.();

      if (!server?.listening) {
        finishGracefully();
        return;
      }

      server.close((error) => finishGracefully(error ?? null));
      server.closeIdleConnections?.();
    });

    return shutdownPromise;
  };
}
