import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ROLE_HOME } from "@/lib/roles";
import { Logo } from "@/components/logo";
import { Icon, type IconName } from "@/components/icons";

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: "clock", title: "Real exam conditions", body: "Timed mock tests that mirror engineering, medical and GST cluster admission exams." },
  { icon: "chart", title: "Instant results", body: "See your score, negative marking and subject-wise breakdown the moment you submit." },
  { icon: "trophy", title: "Merit leaderboard", body: "Know where you stand among every candidate in your batch and across the center." },
  { icon: "book", title: "Bangla & English", body: "Questions in Bangla or English with properly rendered math, physics and chemistry formulas." },
];

export default async function HomePage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  return (
    <div className="relative min-h-dvh overflow-hidden bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] max-w-[160vw] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]"
      />
      <header className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        {user ? (
          <Link href={ROLE_HOME[user.role]} className="btn btn-primary">Dashboard</Link>
        ) : (
          <Link href="/login" className="btn btn-secondary">Log in</Link>
        )}
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-24">
        <section className="max-w-3xl">
          <span className="badge border-accent/30 bg-accent-soft text-accent-text">Admission Test Preparation</span>
          <h1 className="mt-5 text-4xl leading-tight font-bold tracking-tight sm:text-6xl sm:leading-[1.05]">
            Prepare smarter.
            <br />
            <span className="text-accent-text">Secure your seat.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
            Mock exams and practice for engineering, medical and public university admission tests, by{" "}
            {settings.institutionName}.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {user ? (
              <Link href={ROLE_HOME[user.role]} className="btn btn-primary px-6">Go to dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-primary px-6">Log in to start</Link>
                {settings.allowSelfRegistration && (
                  <Link href="/register" className="btn btn-secondary px-6">Create an account</Link>
                )}
              </>
            )}
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Features">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-text">
                <Icon name={f.icon} />
              </span>
              <h2 className="mt-4 font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative border-t border-line py-6 text-center text-xs text-subtle">
        © {new Date().getFullYear()} {settings.institutionName}
      </footer>
    </div>
  );
}
