"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";

const inputClass =
  "mt-1 block w-full rounded-lg border border-fern-200 bg-white px-3 py-2.5 text-fern-900 placeholder-fern-400 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20 transition-colors";
const labelClass = "block text-sm font-medium text-fern-700";

function ResetPasswordFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      router.push("/login?reset=1");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fern-50 px-4">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border border-fern-200/80 bg-white p-8 shadow-lg shadow-fern-900/5 text-center">
          <h1 className="text-xl font-semibold text-fern-900">Invalid link</h1>
          <p className="text-sm text-fern-600">
            This reset link is missing or invalid. Please request a new one from the forgot password page.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-lg bg-fern-500 text-white py-2.5 px-4 font-medium hover:bg-fern-600 transition-colors"
          >
            Forgot password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-fern-50 px-4">
      <div className="w-full max-w-sm space-y-8 rounded-2xl border border-fern-200/80 bg-white p-8 shadow-lg shadow-fern-900/5">
        <div className="flex flex-col items-center text-center">
          <Link href="/app" className="flex items-center justify-center gap-2 text-fern-900 mb-4">
            <Image src="/doorstep/DL_icon_RGB.svg" alt="" width={48} height={48} className="h-12 w-auto" unoptimized />
            <Image src="/doorstep/doorstep-logo-wordmark.svg" alt="Doorstep" width={120} height={32} className="h-8 w-auto" unoptimized />
          </Link>
          <h1 className="text-2xl font-semibold text-fern-900">
            Set new password
          </h1>
          <p className="mt-2 text-sm text-fern-600">
            Enter your new password below.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label htmlFor="password" className={labelClass}>
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm" className={labelClass}>
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-fern-500 text-white py-2.5 px-4 font-medium hover:bg-fern-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
        <p className="text-center text-sm text-fern-600">
          <Link href="/login" className="font-medium text-fern-600 hover:text-fern-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-fern-50 text-fern-600">
        Loading…
      </div>
    }>
      <ResetPasswordFormInner />
    </Suspense>
  );
}
