import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { StudentExamCard } from "@/features/student/exam-card";
import { getStudentExams, type StudentExamItem } from "@/features/student/student-exams";

export const metadata: Metadata = { title: "Exams" };

export default async function StudentExamsPage() {
  const user = await requireRole("STUDENT");
  const exams = await getStudentExams(user);
  const groups: [string, StudentExamItem[]][] = [
    ["In progress", exams.filter((e) => e.inProgressId)],
    ["Live now", exams.filter((e) => !e.inProgressId && e.state === "LIVE" && e.canStart)],
    ["Upcoming", exams.filter((e) => e.state === "UPCOMING")],
    ["Always available", exams.filter((e) => !e.inProgressId && e.state === "ALWAYS" && e.canStart)],
    ["Completed", exams.filter((e) => !e.inProgressId && !e.canStart && e.state !== "UPCOMING" && e.attempts > 0)],
  ];
  const any = groups.some(([, list]) => list.length);
  return (
    <>
      <PageHeader title="Exams" description="Live, upcoming and practice exams for your batch." />
      {!any && <EmptyState icon="clipboard" title="No exams yet">When an exam is published for your batch, it will appear here.</EmptyState>}
      <div className="space-y-8">
        {groups.map(([title, list]) =>
          list.length ? (
            <section key={title}>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {list.map((e) => <StudentExamCard key={e.id} exam={e} />)}
              </ul>
            </section>
          ) : null,
        )}
      </div>
    </>
  );
}
