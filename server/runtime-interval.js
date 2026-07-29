export function boundedRuntimeInterval(value, {
  name,
  fallback,
  minimum,
  maximum,
}) {
  const source = value === null || value === undefined || String(value).trim() === ""
    ? fallback
    : value;
  const parsed = Number(source);
  if (
    !Number.isSafeInteger(parsed)
    || parsed < minimum
    || parsed > maximum
  ) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum} milliseconds.`);
  }
  return parsed;
}
