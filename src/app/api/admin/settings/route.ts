import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  institutionName: z.string().trim().min(2, "Institution name is too short.").max(80).optional(),
  allowSelfRegistration: z.boolean().optional(),
  defaultNegativeMarking: z.boolean().optional(),
  defaultNegativeMark: z.number().min(0).max(100).optional(),
  overallLeaderboardEnabled: z.boolean().optional(),
  overallLeaderboardTopN: z.number().int().min(1).max(10000).nullable().optional(),
});

export async function GET() {
  const { error } = await requireApiRole("ADMIN");
  if (error) return error;
  return NextResponse.json({ settings: await getSettings() });
}

export async function PATCH(req: Request) {
  const { error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  const settings = await db.setting.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  return NextResponse.json({ settings });
}
