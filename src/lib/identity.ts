/**
 * Normalise a Bangladeshi mobile number to the local 11-digit form (01XXXXXXXXX).
 * Accepts 01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX, with spaces or dashes.
 * Returns null when the value is not a valid BD mobile number.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("880")) digits = digits.slice(2);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Interpret a login identifier as either an email or a phone number. */
export function parseIdentifier(
  input: string,
): { email: string } | { phone: string } | null {
  const value = input.trim();
  if (value.includes("@")) {
    const email = normalizeEmail(value);
    return email ? { email } : null;
  }
  const phone = normalizePhone(value);
  return phone ? { phone } : null;
}
