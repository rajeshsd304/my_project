import { formatDuration } from "@/lib/exams";
import { formatNumber } from "@/lib/format";
import { Icon } from "./icons";

export type BoardRow = { rank: number; userId: string; name: string; batch: string | null; score: number; timeTakenSec: number; extra?: string };

const MEDAL = ["text-[#f5c542]", "text-[#c9d1d9]", "text-[#d08c4a]"];

/** Ranked table; highlights the viewer's own row and shows it below a top-N cut. */
export function LeaderboardTable({ rows, topN, viewerId, scoreLabel = "Score", extraLabel }: { rows: BoardRow[]; topN?: number | null; viewerId?: string; scoreLabel?: string; extraLabel?: string }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted">No results yet.</p>;
  const shown = topN ? rows.slice(0, topN) : rows;
  const me = viewerId ? rows.find((r) => r.userId === viewerId) : undefined;
  const meHidden = me && !shown.includes(me);
  const line = (r: BoardRow, self: boolean) => (
    <tr key={r.userId} className={self ? "[&>td]:bg-accent-soft" : ""}>
      <td className="w-14 font-bold tabular-nums">
        <span className="flex items-center gap-1">
          {r.rank <= 3 ? <Icon name="trophy" className={`size-4 ${MEDAL[r.rank - 1]}`} /> : null}#{r.rank}
        </span>
      </td>
      <td>
        <div className="font-medium" lang="bn">{r.name}{self && <span className="ml-2 text-xs font-semibold text-accent-text">You</span>}</div>
        {r.batch && <div className="text-xs text-subtle">{r.batch}</div>}
      </td>
      <td className="text-right font-semibold tabular-nums">{formatNumber(r.score)}</td>
      {extraLabel && <td className="hidden text-right text-muted tabular-nums sm:table-cell">{r.extra}</td>}
      <td className="text-right whitespace-nowrap text-muted tabular-nums">{formatDuration(r.timeTakenSec)}</td>
    </tr>
  );
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th className="text-right">{scoreLabel}</th>
            {extraLabel && <th className="hidden text-right sm:table-cell">{extraLabel}</th>}
            <th className="text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => line(r, r.userId === viewerId))}
          {meHidden && (
            <>
              <tr><td colSpan={5} className="py-1 text-center text-xs text-subtle">⋯</td></tr>
              {line(me, true)}
            </>
          )}
        </tbody>
      </table>
      {topN && rows.length > topN && <p className="px-4 py-3 text-xs text-subtle">Showing the top {topN} of {rows.length}.</p>}
    </div>
  );
}
