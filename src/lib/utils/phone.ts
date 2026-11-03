export function normalizeVietnamesePhone(input: string): string | null {
  const compact = input.trim().replace(/[\s.\-()]/g, "");
  const withLeadingZero = compact
    .replace(/^\+84/, "0")
    .replace(/^84(?=\d{9}$)/, "0");

  if (!/^0\d{9}$/.test(withLeadingZero)) {
    return null;
  }

  return withLeadingZero;
}
