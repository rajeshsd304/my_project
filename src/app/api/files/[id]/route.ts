import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { readStoredFile } from "@/lib/storage";

/** Serves uploaded files (question images, note PDFs) to any logged-in user. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireApiRole("ADMIN", "TEACHER", "STUDENT");
  if (error) return error;
  const { id } = await params;
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return jsonError("File not found.", 404);
  const data = await readStoredFile(file.path).catch(() => null);
  if (!data) return jsonError("File not found.", 404);
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    },
  });
}
