import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";

export async function GET() {
  const { user, error } = await requireApiRole("ADMIN", "TEACHER");
  if (error) return error;
  const imports = await db.questionImport.findMany({
    where: user.role === "ADMIN" ? {} : { createdById: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { createdBy: { select: { name: true } } },
  });
  return NextResponse.json({ imports });
}
