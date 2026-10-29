import { formatDateTime } from "@/lib/format";
import { RichText } from "@/components/rich-text";
import { Icon } from "@/components/icons";

export function AnnouncementCard({ a }: { a: { title: string; body: string; pinned: boolean; createdAt: Date | string; batch?: { name: string } | null } }) {
  return (
    <article className={`card p-4 sm:p-5 ${a.pinned ? "border-accent/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {a.pinned && <span className="badge gap-1 border-accent/40 bg-accent-soft text-accent-text"><Icon name="megaphone" className="size-3" /> Pinned</span>}
        {a.batch && <span className="badge border-line-strong text-muted">{a.batch.name}</span>}
        <span className="text-xs text-subtle">{formatDateTime(a.createdAt)}</span>
      </div>
      <h3 className="mt-2 font-semibold" lang="bn">{a.title}</h3>
      <RichText text={a.body} className="mt-1.5 text-sm leading-relaxed text-fg/85" />
    </article>
  );
}
