import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody, uniqueViolationField } from "@/lib/api";

type Ctx = { params: Promise<{ kind: string; id: string }> };
const KINDS = ["unit", "subject", "topic"] as const;
type Kind = (typeof KINDS)[number];

function isKind(k: string): k is Kind {
  return (KINDS as readonly string[]).includes(k);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { kind, id } = await params;
  if (!isKind(kind)) return jsonError("Not found.", 404);
  const { data, error } = await parseBody(req, z.object({ name: z.string().trim().min(1, "Name is required.").max(80) }));
  if (error) return error;
  try {
    const item =
      kind === "unit"
        ? await db.unit.update({ where: { id }, data })
        : kind === "subject"
          ? await db.subject.update({ where: { id }, data })
          : await db.topic.update({ where: { id }, data });
    return NextResponse.json({ item });
  } catch (err) {
    if (uniqueViolationField(err)) return jsonError(`A ${kind} with this name already exists here.`, 409);
    return jsonError(`${kind[0].toUpperCase() + kind.slice(1)} not found.`, 404);
  }
}

/** Units/subjects that still contain questions can't be deleted; deleting a topic just untags its questions. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await requireApiRole("ADMIN");
  if (error) return error;
  const { kind, id } = await params;
  if (!isKind(kind)) return jsonError("Not found.", 404);
  if (kind === "topic") {
    await db.topic.delete({ where: { id } }).catch(() => null);
    return NextResponse.json({ ok: true });
  }
  const questions = await db.question.count({ where: kind === "unit" ? { subject: { unitId: id } } : { subjectId: id } });
  if (questions > 0) {
    return jsonError(`This ${kind} still has ${questions} question(s). Move or delete them first.`, 409);
  }
  if (kind === "unit") await db.unit.delete({ where: { id } }).catch(() => null);
  else await db.subject.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
