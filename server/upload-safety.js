export const DEFAULT_MULTIPART_LIMITS = Object.freeze({
  fieldNameSize: 100,
  fieldSize: 16 * 1024,
  fields: 8,
  files: 1,
  headerPairs: 100,
  parts: 10,
});

export function createMultipartUploadLimits(maxUploadBytes) {
  if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes <= 0) {
    throw new TypeError("maxUploadBytes must be a positive safe integer.");
  }

  return {
    ...DEFAULT_MULTIPART_LIMITS,
    fileSize: maxUploadBytes,
  };
}
