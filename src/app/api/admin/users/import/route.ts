import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { parseStudentCsv, type ImportRowError } from "@/lib/csv-import";
import { generatePassword, hashPassword } from "@/lib/password";

const schema = z.object({
  csv: z.string().min(1, "Choose a CSV file to import.").max(2_000_000, "File is too large (max 2 MB)."),
  /** Batch for rows whose batch column is empty. */
  defaultBatchId: z.string().nullable().optional(),
  /** Create batches named in the file that don't exist yet. */
  createMissingBatches: z.boolean().default(true),
});

export async function POST(req: Request) {
  const { error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const { rows, errors } = parseStudentCsv(data.csv);

  if (data.defaultBatchId && !(await db.batch.count({ where: { id: data.defaultBatchId } }))) {
    return jsonError("Default batch no longer exists.");
  }

  // Skip rows whose phone/email already belongs to an account.
  const existing = await db.user.findMany({
    where: {
      OR: [
        { phone: { in: rows.map((r) => r.phone) } },
        { email: { in: rows.flatMap((r) => (r.email ? [r.email] : [])) } },
      ],
    },
    select: { phone: true, email: true },
  });
  const takenPhones = new Set(existing.map((u) => u.phone));
  const takenEmails = new Set(existing.map((u) => u.email));
  const skipped: ImportRowError[] = [];
  const fresh = rows.filter((r) => {
    if (takenPhones.has(r.phone)) {
      skipped.push({ line: r.line, message: `Phone ${r.phone} already has an account.` });
      return false;
    }
    if (r.email && takenEmails.has(r.email)) {
      skipped.push({ line: r.line, message: `Email ${r.email} already has an account.` });
      return false;
    }
    return true;
  });

  // Resolve batch names (case-insensitive) to ids.
  const batches = await db.batch.findMany({ select: { id: true, name: true } });
  const batchByName = new Map(batches.map((b) => [b.name.toLowerCase(), b.id]));
  const missing = [...new Set(fresh.flatMap((r) => (r.batch && !batchByName.has(r.batch.toLowerCase()) ? [r.batch] : [])))];
  const toImport = data.createMissingBatches
    ? fresh
    : fresh.filter((r) => {
        if (r.batch && !batchByName.has(r.batch.toLowerCase())) {
          skipped.push({ line: r.line, message: `Batch "${r.batch}" does not exist.` });
          return false;
        }
        return true;
      });

  const prepared = await Promise.all(
    toImport.map(async (r) => {
      const password = r.password ?? generatePassword();
      return { row: r, password, passwordHash: await hashPassword(password) };
    }),
  );

  const createdBatches: string[] = [];
  await db.$transaction(async (tx) => {
    if (data.createMissingBatches) {
      for (const name of missing) {
        const batch = await tx.batch.create({ data: { name } });
        batchByName.set(name.toLowerCase(), batch.id);
        createdBatches.push(name);
      }
    }
    for (const { row, passwordHash } of prepared) {
      await tx.user.create({
        data: {
          name: row.name,
          phone: row.phone,
          email: row.email,
          role: "STUDENT",
          passwordHash,
          batchId: row.batch ? batchByName.get(row.batch.toLowerCase()) : (data.defaultBatchId ?? null),
        },
      });
    }
  }, { timeout: 60_000 });

  return NextResponse.json({
    created: prepared.map(({ row, password }) => ({
      line: row.line,
      name: row.name,
      phone: row.phone,
      email: row.email,
      batch: row.batch,
      // Only generated passwords are echoed back; admin-supplied ones are already known.
      password: row.password ? null : password,
    })),
    createdBatches,
    errors: [...errors, ...skipped].sort((a, b) => a.line - b.line),
  });
}
