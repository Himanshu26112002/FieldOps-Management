"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loginSchema } from "@fieldops/shared-validation";
import { getFirebase } from "@/lib/firebase/client";
import { useEmulators } from "@/lib/firebase/config";
import { authErrorMessage, LOGIN_REASON_KEY } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // Show why the workspace signed the user out (set by the session provider), once.
  useEffect(() => {
    let reason: string | null = null;
    try {
      reason = sessionStorage.getItem(LOGIN_REASON_KEY);
      sessionStorage.removeItem(LOGIN_REASON_KEY);
    } catch {
      // Storage unavailable; nothing to show.
    }
    if (!reason) return;
    const message = reason;
    void Promise.resolve().then(() => setErrors({ form: message }));
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors({
        email: parsed.error.issues.find((issue) => issue.path[0] === "email")?.message,
        password: parsed.error.issues.find((issue) => issue.path[0] === "password")?.message,
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { auth } = getFirebase();
      await signInWithEmailAndPassword(auth, parsed.data.email, parsed.data.password);
      router.replace("/dashboard");
    } catch (error) {
      setErrors({ form: authErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground shadow-card outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/12";

  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-nav px-14 py-12 text-nav-foreground lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-[#2b4fb3]/30 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#2b4fb3] to-[#16295f] text-sm font-bold tracking-wide text-white ring-1 ring-white/15">
            FO
          </span>
          <span className="text-lg font-semibold text-white">FieldOps</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <span className="mb-6 block h-[3px] w-12 rounded-full bg-accent" aria-hidden />
          <h2 className="text-[2.15rem] font-semibold leading-[1.15] text-white">
            Every client visit, accounted for.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-nav-foreground">
            Schedule field visits, verify GPS check-ins and review every report before it reaches your books.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-nav-border pt-6 text-sm">
            {[
              ["Verified", "GPS check-in"],
              ["Reviewed", "Approval workflow"],
              ["Audited", "Complete trail"],
            ].map(([title, text]) => (
              <div key={title}>
                <dt className="font-semibold text-white">{title}</dt>
                <dd className="mt-1 text-xs text-nav-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="relative mt-12 text-xs text-nav-muted">Sales Field Force Management &amp; Client Visit Tracking</p>
      </section>

      {/* Sign-in form */}
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-nav text-sm font-bold tracking-wide text-white">FO</span>
            <span className="text-lg font-semibold">FieldOps</span>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Administrator access</p>
          <h1 className="mt-2 text-[1.75rem] font-semibold">Sign in to FieldOps</h1>
          <p className="mt-1.5 text-sm text-muted">Use the work account your organisation provisioned for you.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
              {errors.email ? <p className="text-xs text-danger">{errors.email}</p> : null}
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
              {errors.password ? <p className="text-xs text-danger">{errors.password}</p> : null}
            </div>
            {errors.form ? (
              <p className="rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{errors.form}</p>
            ) : null}
            <button
              disabled={submitting}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:brightness-110 active:translate-y-px disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted">
            Accounts are provisioned by your administrator. Salespeople sign in through the FieldOps mobile app.{" "}
            <Link href="/" className="font-medium text-primary hover:underline">
              Back to home
            </Link>
          </div>
          {useEmulators ? (
            <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
              Demo: <span className="font-mono">admin@fieldops.local</span> / <span className="font-mono">Admin123!</span>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
