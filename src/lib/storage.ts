// Local file storage for question images and study notes (STORAGE_DIR, default ./storage).
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

const ROOT = path.resolve(process.env.STORAGE_DIR ?? "storage");

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const NOTE_MAX_BYTES = 20 * 1024 * 1024;

/** Identify a file from its first bytes (never trust the browser-supplied type). */
export function sniffMime(buf: Uint8Array): string | null {
  const b = (i: number) => buf[i];
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) return "image/gif";
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45) return "image/webp";
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return "application/pdf";
  return null;
}

export const isImageMime = (m: string | null) => !!m && m.startsWith("image/");

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function saveFile(opts: { name: string; mime: string; data: Uint8Array; userId?: string | null }) {
  const rel = path.join(new Date().toISOString().slice(0, 7), `${randomUUID()}.${EXT[opts.mime] ?? "bin"}`);
  const abs = path.join(ROOT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, opts.data);
  return db.storedFile.create({
    data: { name: opts.name.slice(0, 200), mime: opts.mime, size: opts.data.byteLength, path: rel, createdById: opts.userId ?? null },
  });
}

export async function readStoredFile(relPath: string) {
  const abs = path.resolve(ROOT, relPath);
  if (!abs.startsWith(ROOT + path.sep)) throw new Error("Invalid path");
  return readFile(abs);
}

export async function deleteStoredFile(id: string) {
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return;
  await db.storedFile.delete({ where: { id } });
  await rm(path.resolve(ROOT, file.path), { force: true });
}

/** Temporary staging area (e.g. an image ZIP between import preview and commit). */
export async function stageTemp(data: Uint8Array) {
  const token = randomUUID();
  const dir = path.join(ROOT, "tmp");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, token), data);
  return token;
}

export async function readTemp(token: string) {
  if (!/^[0-9a-f-]{36}$/.test(token)) return null;
  return readFile(path.join(ROOT, "tmp", token)).catch(() => null);
}

export async function removeTemp(token: string) {
  if (/^[0-9a-f-]{36}$/.test(token)) await rm(path.join(ROOT, "tmp", token), { force: true });
}
