"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { GhostWriterLogo } from "@/components/brand/GhostWriterLogo";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    setInfo("Check your email to verify your account, then log in.");
    setLoading(false);
  }

  async function resendConfirmation() {
    if (!email.trim()) {
      setError("Enter your email above, then resend.");
      return;
    }

    setResending(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    setResending(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setInfo("Confirmation email resent. Check your inbox and spam folder.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md animate-fade-up">
        <Link href="/" className="inline-flex text-xl">
          <GhostWriterLogo markSize={30} className="text-xl" />
        </Link>
        <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Start with a calm home for your day.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Name</span>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none ring-[var(--accent)] focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none ring-[var(--accent)] focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none ring-[var(--accent)] focus:ring-2"
            />
          </label>
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="text-sm text-[var(--accent)]" role="status">
              {info}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[var(--ink)] py-3 text-sm font-semibold text-[var(--canvas)] disabled:opacity-60"
          >
            {loading ? "Creating…" : "Sign up"}
          </button>
          <button
            type="button"
            onClick={() => void resendConfirmation()}
            disabled={resending || !email.trim()}
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-3 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
          >
            {resending ? "Resending…" : "Resend confirmation email"}
          </button>
        </form>

        <p className="mt-6 text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--accent)]">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
