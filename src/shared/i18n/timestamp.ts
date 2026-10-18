export function formatTimestamp(milliseconds: bigint, locale: string): string {
  const value = Number(milliseconds);
  const date = new Date(value);
  return Number.isSafeInteger(value) && Number.isFinite(date.getTime())
    ? date.toLocaleString(locale)
    : milliseconds.toString();
}
