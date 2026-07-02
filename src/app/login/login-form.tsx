"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const inputClass =
  "mt-1 block w-full rounded-lg border border-fern-200 bg-white px-3 py-2.5 text-fern-900 placeholder-fern-400 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20 transition-colors";
const labelClass = "block text-sm font-medium text-fern-700";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/welcome";
  const resetSuccess = searchParams.get("reset") === "1";
  const registered = searchParams.get("registered") === "1";
  const verified = searchParams.get("verified") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }
      const redirect = res?.url ?? callbackUrl;
      router.push(redirect);
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-fern-50 px-4">
      <div className="w-full max-w-sm space-y-8 rounded-2xl border border-fern-200/80 bg-white p-8 shadow-lg shadow-fern-900/5">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="flex items-center justify-center gap-2 text-fern-900 mb-4">
            <Image src="/doorstep/DL_icon_RGB.svg" alt="" width={48} height={48} className="h-12 w-auto" unoptimized />
            <Image src="/doorstep/doorstep-logo-wordmark.svg" alt="Doorstep" width={120} height={32} className="h-8 w-auto" unoptimized />
          </Link>
          <Image src="/doorstep/doorstep-logo-subtext.svg" alt="" width={160} height={40} className="h-10 w-auto opacity-90" unoptimized />
          <h1 className="mt-6 text-2xl font-semibold text-fern-900">
            Sign in
          </h1>
        </div>
        <form onSubmit={handleCredentials} className="space-y-5">
          {verified && (
            <p className="text-sm text-fern-700 bg-fern-50 rounded-lg px-3 py-2">
              Your email is verified. You can sign in below.
            </p>
          )}
          {registered && (
            <p className="text-sm text-fern-700 bg-fern-50 rounded-lg px-3 py-2">
              Account created. Check your inbox for a link to verify your email before signing in with your password.
            </p>
          )}
          {resetSuccess && (
            <p className="text-sm text-fern-700 bg-fern-50 rounded-lg px-3 py-2">
              Your password has been updated. Sign in with your new password.
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-fern-600 hover:text-fern-700"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-fern-700">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="rounded border-fern-200 text-fern-500 focus:ring-fern-500"
              />
              Show password
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-fern-500 text-white py-2.5 px-4 font-medium hover:bg-fern-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <details className="rounded-lg border border-fern-200 bg-fern-50/50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-fern-800 select-none">
            Resend verification email
          </summary>
          <div className="mt-3 space-y-2 pt-1">
            <p className="text-xs text-fern-600">
              If you signed up with email and password, we can send a new verification link.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                autoComplete="email"
                placeholder="Your email"
                value={resendEmail}
                onChange={(e) => {
                  setResendEmail(e.target.value);
                  setResendMessage("");
                }}
                className={inputClass}
              />
              <button
                type="button"
                disabled={resendLoading || !resendEmail.trim()}
                onClick={async () => {
                  setResendLoading(true);
                  setResendMessage("");
                  try {
                    const res = await fetch("/api/auth/resend-verification", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: resendEmail.trim() }),
                    });
                    const data = await res.json().catch(() => ({}));
                    setResendMessage(
                      typeof data.message === "string"
                        ? data.message
                        : "Request sent."
                    );
                  } catch {
                    setResendMessage("Something went wrong.");
                  }
                  setResendLoading(false);
                }}
                className="shrink-0 rounded-lg border border-fern-200 bg-white px-4 py-2.5 text-sm font-medium text-fern-700 hover:bg-fern-50 disabled:opacity-50"
              >
                {resendLoading ? "Sending…" : "Send link"}
              </button>
            </div>
            {resendMessage ? (
              <p className="text-xs text-fern-600">{resendMessage}</p>
            ) : null}
          </div>
        </details>
        {process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" && (
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-fern-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-fern-500">Or</span>
            </div>
          </div>
        )}
        {process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" && (
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="w-full rounded-lg border border-fern-200 bg-white py-2 px-4 font-medium text-fern-700 hover:bg-fern-50 transition-colors"
          >
            Sign in with Google
          </button>
        )}
        <p className="text-center text-sm text-fern-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-fern-600 hover:text-fern-700">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
