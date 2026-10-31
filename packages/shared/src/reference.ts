/** Compact display reference. Keep the original ID for API calls and links. */
export function formatReference(value: string | null | undefined, prefix: string): string {
  if (!value?.trim()) return "—";
  const text = value.trim();
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(text)) {
    const hex = text.replaceAll("-", "");
    return `${prefix}-${hex.slice(0, 4).toUpperCase()}-${hex.slice(-6).toUpperCase()}`;
  }
  return /^[0-9a-f]{8}$/i.test(text) ? `${prefix}-${text.toUpperCase()}` : text;
}
