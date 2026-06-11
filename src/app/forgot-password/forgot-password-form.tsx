"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const inputClass =
  "mt-1 block w-full rounded-lg border border-fern-200 bg-white px-3 py-2.5 text-fern-900 placeholder-fern-400 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20 transition-colors";
const labelClass = "block text-sm font-medium text-fern-700";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
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
            Forgot password
          </h1>
          <p className="mt-2 text-sm text-fern-600">
            Enter your email and we&apos;ll send a link to reset your password.
          </p>
        </div>
        {success ? (
          <div className="space-y-4">
            <p className="text-sm text-fern-700 bg-fern-50 rounded-lg px-3 py-3">
              If an account exists with that email, we&apos;ve sent a password reset link. Check your inbox and spam folder.
            </p>
            <Link
              href="/login"
              className="block w-full text-center rounded-lg bg-fern-500 text-white py-2.5 px-4 font-medium hover:bg-fern-600 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
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
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-fern-500 text-white py-2.5 px-4 font-medium hover:bg-fern-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="text-center text-sm text-fern-600">
          <Link href="/login" className="font-medium text-fern-600 hover:text-fern-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
