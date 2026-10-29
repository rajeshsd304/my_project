import { requireRole } from "@/lib/auth";

// Distraction-free exam screen: no navigation shell. Students only.
export const dynamic = "force-dynamic";

export default async function ExamLayout({ children }: { children: React.ReactNode }) {
  await requireRole("STUDENT");
  return <div className="min-h-dvh bg-black">{children}</div>;
}
