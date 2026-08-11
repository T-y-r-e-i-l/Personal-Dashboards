import Link from "next/link";
import { GhostWriterLogo } from "@/components/brand/GhostWriterLogo";

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 70% -10%, rgba(61,107,90,0.14), transparent 60%), radial-gradient(800px 400px at 10% 100%, rgba(22,22,22,0.05), transparent 50%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <GhostWriterLogo markSize={30} className="text-xl" />
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)] transition hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-start justify-center px-6 pb-24 pt-10 md:px-10">
        <GhostWriterLogo
          markSize={56}
          className="mb-6 text-4xl md:text-5xl"
        />
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight md:text-7xl">
          Your day, one calm surface.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
          Capture thoughts, track habits, and see what matters — in a
          minimal bento dashboard built for real life.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Start free
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-medium transition hover:bg-[var(--surface-soft)]"
          >
            I already have an account
          </Link>
        </div>
      </section>
    </main>
  );
}
