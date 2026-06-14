export function firstReturnedRow<T = Record<string, unknown>>(result: unknown): T | undefined {
  if (!Array.isArray(result)) return undefined;
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0] as T | undefined;
}
