import Link from "next/link";
import { EXAM_TYPE_LABEL, type ExamType } from "@/lib/exams";
import { formatDateTime } from "@/lib/format";
import { Icon } from "@/components/icons";
import type { StudentExamItem } from "./student-exams";

export function StudentExamCard({ exam }: { exam: StudentExamItem }) {
  const badge =
    exam.inProgressId ? (
      <span className="badge border-warning/40 bg-warning-soft text-warning">In progress</span>
    ) : exam.state === "LIVE" ? (
      <span className="badge border-danger/40 bg-danger-soft text-danger">● Live now</span>
    ) : exam.state === "UPCOMING" ? (
      <span className="badge border-accent/40 text-accent-text">Upcoming</span>
    ) : exam.state === "ENDED" ? (
      <span className="badge border-line-strong text-subtle">Ended</span>
    ) : (
      <span className="badge border-success/40 text-success">Available</span>
    );
  return (
    <li className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{exam.title}</h3>
        {badge}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span>{EXAM_TYPE_LABEL[exam.type as ExamType]}</span>
        <span>{exam.questionCount} questions · {exam.totalMarks} marks</span>
        <span>{exam.durationMinutes ? `${exam.durationMinutes} min` : "Untimed"}</span>
        <span className={exam.negativeMarking ? "text-warning" : ""}>
          {exam.negativeMarking ? `−${exam.negativeMark.toFixed(2)} per wrong` : "No negative marking"}
        </span>
      </div>
      {exam.startsAt && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-subtle">
          <Icon name="clock" className="size-3.5" /> {formatDateTime(exam.startsAt)} – {formatDateTime(exam.endsAt)}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        {exam.inProgressId ? (
          <Link href={`/exam/${exam.inProgressId}`} className="btn btn-primary min-h-10 flex-1">Resume exam</Link>
        ) : exam.canStart ? (
          <Link href={`/student/exams/${exam.id}`} className="btn btn-primary min-h-10 flex-1">{exam.attempts ? "Retake" : "Start"}</Link>
        ) : exam.state === "UPCOMING" ? (
          <Link href={`/student/exams/${exam.id}`} className="btn btn-secondary min-h-10 flex-1">View details</Link>
        ) : null}
        {exam.lastSubmittedId && (
          <Link href={`/student/results/${exam.lastSubmittedId}`} className="btn btn-secondary min-h-10 flex-1">View result</Link>
        )}
      </div>
    </li>
  );
}
