"use client";

// Lightweight SVG/HTML charts (no chart library: keeps pages fast on slow mobile data).
// Single-series marks use the accent; weak items carry a text label + icon, never color alone.
import { useState } from "react";
import { Icon } from "./icons";

const MARK = "var(--accent-hover)";

/** Horizontal bars of a 0–100% value, e.g. subject accuracy. Doubles as the data table (values are printed). */
export function BarList({
  items,
}: {
  items: { id: string; label: string; value: number; detail?: string; flag?: "weak" | "strong" }[];
}) {
  if (!items.length) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.id} title={it.detail ? `${it.label}: ${it.value}% (${it.detail})` : `${it.label}: ${it.value}%`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{it.label}</span>
              {it.flag === "weak" && (
                <span className="badge shrink-0 gap-1 border-warning/40 text-warning"><Icon name="close" className="size-3" /> Weak</span>
              )}
              {it.flag === "strong" && (
                <span className="badge shrink-0 gap-1 border-success/40 text-success"><Icon name="check" className="size-3" /> Strong</span>
              )}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {it.value}%{it.detail && <span className="ml-1.5 text-xs font-normal text-subtle">{it.detail}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="presentation">
            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, it.value))}%`, background: MARK }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Score trend: percentage per exam over time, with hover crosshair + tooltip. */
export function TrendChart({ points }: { points: { label: string; date: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="text-sm text-muted">Take at least two exams to see your trend.</p>;
  const W = 640;
  const H = 220;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const min = Math.min(0, ...points.map((p) => p.value));
  const max = 100;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + ((max - v) * (H - pad.t - pad.b)) / (max - min);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const ticks = [0, 25, 50, 75, 100];
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Score trend across ${points.length} exams`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-subtle)">{t}%</text>
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--border-strong)" strokeWidth={1} />}
        <path d={path} fill="none" stroke={MARK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : 4} fill={MARK} stroke="var(--surface)" strokeWidth={2} />
        ))}
        {points.map((p, i) => (
          <rect
            key={`hit${i}`}
            x={x(i) - (W - pad.l - pad.r) / (points.length - 1) / 2}
            y={0}
            width={(W - pad.l - pad.r) / (points.length - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onTouchStart={() => setHover(i)}
          />
        ))}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line-strong bg-surface-3 px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <div className="max-w-48 truncate font-semibold">{h.label}</div>
          <div className="text-muted">{h.date}</div>
          <div className="mt-0.5 font-semibold tabular-nums">{h.value}%</div>
        </div>
      )}
    </div>
  );
}

/** Vertical histogram (e.g. score distribution) with per-bar hover tooltips. */
export function Histogram({ buckets, unit = "students" }: { buckets: { label: string; count: number }[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div>
      <div className="relative flex h-44 items-end gap-0.5 border-b border-line-strong" role="img" aria-label="Score distribution">
        {buckets.map((b, i) => (
          <div key={b.label} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div
              className="w-full rounded-t-[4px] transition-opacity"
              style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? 3 : 0, background: MARK, opacity: hover === null || hover === i ? 1 : 0.55 }}
            />
            {hover === i && (
              <div className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg border border-line-strong bg-surface-3 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg">
                <span className="font-semibold tabular-nums">{b.count}</span> {unit} · {b.label}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.5 text-[10px] text-subtle">
        {buckets.map((b, i) => (
          <span key={b.label} className="flex-1 text-center">{i === 0 ? "≤10" : i % 2 === 0 ? b.label.split("–")[0] : ""}</span>
        ))}
      </div>
      <p className="mt-1 text-center text-xs text-subtle">Score (% of total marks)</p>
    </div>
  );
}
