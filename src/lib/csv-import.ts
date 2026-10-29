import Papa from "papaparse";
import { normalizeEmail, normalizePhone } from "./identity";
import { MIN_PASSWORD_LENGTH } from "./password";

export const MAX_IMPORT_ROWS = 2000;

export type ImportRow = {
  line: number;
  name: string;
  phone: string;
  batch: string | null;
  email: string | null;
  password: string | null;
};

export type ImportRowError = { line: number; message: string };

const HEADER_ALIASES: Record<string, keyof Omit<ImportRow, "line">> = {
  name: "name",
  "full name": "name",
  "student name": "name",
  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  "mobile number": "phone",
  batch: "batch",
  "batch name": "batch",
  email: "email",
  password: "password",
};

/**
 * Parse an import CSV. Expected columns: name, phone, batch (optional: email, password).
 * A header row is optional; without one, columns are read as name, phone, batch.
 */
export function parseStudentCsv(text: string): { rows: ImportRow[]; errors: ImportRowError[] } {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const lines = parsed.data;
  const errors: ImportRowError[] = [];
  if (!lines.length) return { rows: [], errors: [{ line: 1, message: "The file is empty." }] };

  const first = lines[0].map((c) => c.trim().toLowerCase());
  const hasHeader = first.some((c) => c in HEADER_ALIASES);
  let columns: (keyof Omit<ImportRow, "line"> | null)[] = ["name", "phone", "batch"];
  if (hasHeader) {
    columns = first.map((c) => HEADER_ALIASES[c] ?? null);
    for (const required of ["name", "phone"] as const) {
      if (!columns.includes(required)) {
        return { rows: [], errors: [{ line: 1, message: `Missing required column "${required}".` }] };
      }
    }
  }

  const body = hasHeader ? lines.slice(1) : lines;
  if (body.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `Too many rows (max ${MAX_IMPORT_ROWS} per import).` }] };
  }

  const rows: ImportRow[] = [];
  const seenPhones = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  body.forEach((cells, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const get = (key: keyof Omit<ImportRow, "line">) => {
      const idx = columns.indexOf(key);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const name = get("name");
    const rawPhone = get("phone");
    const rawEmail = get("email");
    const password = get("password") || null;

    if (name.length < 2) return errors.push({ line, message: "Name is missing or too short." });
    const phone = normalizePhone(rawPhone);
    if (!phone) return errors.push({ line, message: `Invalid phone number "${rawPhone}".` });
    const email = rawEmail ? normalizeEmail(rawEmail) : null;
    if (rawEmail && !email) return errors.push({ line, message: `Invalid email "${rawEmail}".` });
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      return errors.push({ line, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    if (seenPhones.has(phone)) {
      return errors.push({ line, message: `Phone ${phone} is repeated (also on line ${seenPhones.get(phone)}).` });
    }
    if (email && seenEmails.has(email)) {
      return errors.push({ line, message: `Email ${email} is repeated (also on line ${seenEmails.get(email)}).` });
    }
    seenPhones.set(phone, line);
    if (email) seenEmails.set(email, line);
    rows.push({ line, name: name.slice(0, 100), phone, batch: get("batch").slice(0, 80) || null, email, password });
  });
  return { rows, errors };
}
