import { db } from "./db";

/** Fields safe to send to the browser. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  active: true,
  batchId: true,
  createdAt: true,
  batch: { select: { id: true, name: true } },
} as const;

/** True if removing admin rights / access from `userId` would leave no active admin. */
export async function isLastActiveAdmin(userId: string) {
  const others = await db.user.count({ where: { role: "ADMIN", active: true, id: { not: userId } } });
  return others === 0;
}

export async function batchExists(batchId: string | null | undefined) {
  if (!batchId) return true;
  return (await db.batch.count({ where: { id: batchId } })) > 0;
}
