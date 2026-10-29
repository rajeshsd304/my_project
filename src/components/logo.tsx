import Link from "next/link";

export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 ${className}`} aria-label="NextCampus home">
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-white shadow-[0_0_24px_rgba(26,107,255,0.45)]">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
          <path d="M2 9.5 12 4l10 5.5L12 15z" strokeLinejoin="round" />
          <path d="M6 12v4.5c0 1.5 2.7 3 6 3s6-1.5 6-3V12" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight">
        Next<span className="text-accent-text">Campus</span>
      </span>
    </Link>
  );
}
