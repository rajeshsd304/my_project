// Date formatting pinned to the coaching center's timezone (server and browser agree).
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? "Asia/Dhaka";

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: TIMEZONE }).format(new Date(d));
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: TIMEZONE }).format(new Date(d));
}

export const formatNumber = (n: number | null | undefined, digits = 2) =>
  n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(digits).replace(/\.?0+$/, "");
