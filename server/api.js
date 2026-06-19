import { randomUUID } from "node:crypto";
import { z } from "zod";

const requestIdSchema = z.uuid();

export class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createRequestContext(request, response, next) {
  const incoming = request.headers["x-request-id"];
  const parsed = requestIdSchema.safeParse(incoming);
  request.requestId = parsed.success ? parsed.data : randomUUID();
  response.setHeader("X-Request-Id", request.requestId);
  next();
}

export function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function validate(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ApiError(422, "VALIDATION_FAILED", "Request validation failed.", {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    })),
  });
}

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(1024).optional(),
});

export function encodeCursor(value) {
  return Buffer.from(JSON.stringify({ version: 1, value }), "utf8").toString("base64url");
}

export function decodeCursor(cursor) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (parsed?.version !== 1 || parsed.value === undefined) throw new Error("Unsupported cursor.");
    return parsed.value;
  } catch {
    throw new ApiError(422, "INVALID_CURSOR", "The pagination cursor is invalid.");
  }
}

export function sendApiError(error, request, response) {
  const status = Number(error.status) || 500;
  const expected = error instanceof ApiError || status < 500;
  response.status(status).json({
    error: {
      code: expected ? (error.code ?? "REQUEST_FAILED") : "INTERNAL_ERROR",
      message: expected ? error.message : "RIVT could not complete the request.",
      requestId: request.requestId ?? null,
      details: expected ? error.details : undefined,
    },
  });
}

export { z };
