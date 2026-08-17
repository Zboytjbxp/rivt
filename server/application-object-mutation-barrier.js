import { AsyncLocalStorage } from "node:async_hooks";
import { ApiError } from "./api.js";

export const APPLICATION_OBJECT_BARRIER_LOCK_NAME = "rivt-application-object-recovery-v1";

const BARRIER_SQL = Object.freeze({
  captureAcquire: "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
  captureRelease: "SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS released",
  mutationAcquire: "SELECT pg_try_advisory_lock_shared(hashtextextended($1, 0)) AS acquired",
  mutationRelease: "SELECT pg_advisory_unlock_shared(hashtextextended($1, 0)) AS released",
});

const SAFE_APPLICATION_OBJECT_COMMANDS = new Set([
  "GetObjectCommand",
  "HeadObjectCommand",
]);

export class ApplicationObjectBarrierError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ApplicationObjectBarrierError";
    this.code = code;
  }
}

function barrierError(code) {
  const message = code === "APPLICATION_OBJECT_BARRIER_BUSY"
    ? "An application-object recovery capture or mutation is already in progress."
    : "The application-object mutation barrier is unavailable.";
  return new ApplicationObjectBarrierError(code, message);
}

function releaseClient(client, error) {
  try {
    client.release(error);
    return true;
  } catch {
    // A failed pool release still fails the operation below. Do not expose the
    // original database error or risk reusing a connection with a held lock.
    return false;
  }
}

async function acquireLease(database, mode, { identityProbe } = {}) {
  if (!database || typeof database.connect !== "function") {
    throw barrierError("APPLICATION_OBJECT_BARRIER_UNAVAILABLE");
  }
  if (identityProbe !== undefined && typeof identityProbe !== "function") {
    throw barrierError("APPLICATION_OBJECT_BARRIER_UNAVAILABLE");
  }
  const shared = mode === "mutation";
  const acquireSql = shared ? BARRIER_SQL.mutationAcquire : BARRIER_SQL.captureAcquire;
  const releaseSql = shared ? BARRIER_SQL.mutationRelease : BARRIER_SQL.captureRelease;
  let client;
  let runtimeIdentity;
  try {
    client = await database.connect();
    if (!client || typeof client.query !== "function" || typeof client.release !== "function") {
      throw new Error("Database pool returned no usable client.");
    }
    const result = await client.query(acquireSql, [APPLICATION_OBJECT_BARRIER_LOCK_NAME]);
    if (result?.rows?.[0]?.acquired !== true) {
      releaseClient(client);
      client = undefined;
      if (result?.rows?.[0]?.acquired === false) {
        throw barrierError("APPLICATION_OBJECT_BARRIER_BUSY");
      }
      throw barrierError("APPLICATION_OBJECT_BARRIER_UNAVAILABLE");
    }
    if (identityProbe) runtimeIdentity = await identityProbe(client);
  } catch (error) {
    if (client) releaseClient(client, error);
    if (error instanceof ApplicationObjectBarrierError) throw error;
    throw barrierError("APPLICATION_OBJECT_BARRIER_UNAVAILABLE");
  }

  let releasePromise;
  return Object.freeze({
    mode,
    runtimeIdentity,
    release() {
      releasePromise ??= (async () => {
        let releaseError;
        try {
          const result = await client.query(releaseSql, [APPLICATION_OBJECT_BARRIER_LOCK_NAME]);
          if (result?.rows?.[0]?.released !== true) {
            releaseError = barrierError("APPLICATION_OBJECT_BARRIER_UNAVAILABLE");
          }
        } catch {
          releaseError = barrierError("APPLICATION_OBJECT_BARRIER_UNAVAILABLE");
        }
        if (!releaseClient(client, releaseError) && !releaseError) {
          releaseError = barrierError("APPLICATION_OBJECT_BARRIER_UNAVAILABLE");
        }
        if (releaseError) throw releaseError;
      })();
      return releasePromise;
    },
  });
}

export function acquireApplicationObjectMutationLease(database) {
  return acquireLease(database, "mutation");
}

export function acquireApplicationObjectCaptureLease(database, options) {
  return acquireLease(database, "capture", options);
}

function mutationApiError(error) {
  if (error?.code === "APPLICATION_OBJECT_BARRIER_BUSY") {
    return new ApiError(
      503,
      "APPLICATION_OBJECT_CAPTURE_IN_PROGRESS",
      "A recovery capture is in progress. Retry this upload or removal shortly.",
    );
  }
  return new ApiError(
    503,
    "APPLICATION_OBJECT_MUTATION_BARRIER_UNAVAILABLE",
    "RIVT cannot safely change stored objects right now.",
  );
}

/**
 * Bind application object-store mutations to a shared advisory-lock lease.
 * The guarded client rejects every command except the explicit read-only
 * allowlist unless it runs inside the matching route-operation lifetime.
 */
export function createApplicationObjectMutationRuntime({
  database,
  onReleaseError = () => undefined,
} = {}) {
  if (typeof onReleaseError !== "function") {
    throw new TypeError("Application-object barrier release handler must be a function.");
  }
  const context = new AsyncLocalStorage();

  function wrapRoute(handler) {
    if (typeof handler !== "function") {
      throw new TypeError("Application-object mutation route must be a function.");
    }
    return async function applicationObjectMutationRoute(request, response, next) {
      let lease;
      try {
        lease = await acquireApplicationObjectMutationLease(database);
      } catch (error) {
        throw mutationApiError(error);
      }
      const state = { active: true, pendingMutations: new Set() };
      let result;
      let handlerError;
      let handlerFailed = false;
      try {
        result = await context.run(state, () => handler(request, response, next));
      } catch (error) {
        handlerError = error;
        handlerFailed = true;
      } finally {
        // A caller must await object mutations, but draining the tracked set
        // also keeps the lease around an accidentally unawaited provider
        // promise that was admitted while this route was active.
        while (state.pendingMutations.size) {
          await Promise.allSettled([...state.pendingMutations]);
        }
        state.active = false;
        try {
          await lease.release();
        } catch (error) {
          try {
            await onReleaseError(error);
          } catch {
            // Logging must not replace the route's original outcome. The
            // lease implementation destroys an unsafe pool connection.
          }
        }
      }
      if (handlerFailed) throw handlerError;
      return result;
    };
  }

  function guardClient(client) {
    if (!client || typeof client.send !== "function") {
      throw new TypeError("Application object-store client must provide send().");
    }
    return Object.freeze({
      async send(command, ...args) {
        const commandName = command?.constructor?.name;
        const readOnly = SAFE_APPLICATION_OBJECT_COMMANDS.has(commandName);
        const state = context.getStore();
        if (!readOnly && state?.active !== true) {
          throw new ApiError(
            503,
            "APPLICATION_OBJECT_MUTATION_BARRIER_REQUIRED",
            "RIVT cannot safely change stored objects outside the mutation barrier.",
          );
        }
        if (readOnly) return client.send(command, ...args);
        const pending = Promise.resolve().then(() => client.send(command, ...args));
        state.pendingMutations.add(pending);
        try {
          return await pending;
        } finally {
          state.pendingMutations.delete(pending);
        }
      },
    });
  }

  return Object.freeze({ wrapRoute, guardClient });
}

export const applicationObjectBarrierInternals = Object.freeze({
  BARRIER_SQL,
  SAFE_APPLICATION_OBJECT_COMMANDS,
});
