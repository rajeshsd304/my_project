import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { IMAGE_MAX_BYTES, NOTE_MAX_BYTES, isImageMime, saveFile, sniffMime } from "@/lib/storage";

/** Upload a question image (kind=image) or a note PDF (kind=pdf). Admin/teacher only. */
export async function POST(req: Request) {
  const { user, error } = await requireApiRole("ADMIN", "TEACHER");
  if (error) return error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind") === "pdf" ? "pdf" : "image";
  if (!(file instanceof File)) return jsonError("Choose a file to upload.");
  const max = kind === "pdf" ? NOTE_MAX_BYTES : IMAGE_MAX_BYTES;
  if (file.size > max) return jsonError(`File is too large (max ${max / 1024 / 1024} MB).`);
  const data = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(data);
  if (kind === "image" ? !isImageMime(mime) : mime !== "application/pdf") {
    return jsonError(kind === "image" ? "Upload a PNG, JPG, GIF or WebP image." : "Upload a PDF file.");
  }
  const stored = await saveFile({ name: file.name, mime: mime!, data, userId: user.id });
  return NextResponse.json({ file: { id: stored.id, name: stored.name, url: `/api/files/${stored.id}` } }, { status: 201 });
}
