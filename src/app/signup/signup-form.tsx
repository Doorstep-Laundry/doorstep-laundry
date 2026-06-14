"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const inputClass =
  "mt-1 block w-full rounded-lg border border-fern-200 bg-white px-3 py-2.5 text-fern-900 placeholder-fern-400 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20 transition-colors";
const labelClass = "block text-sm font-medium text-fern-700";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/welcome";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Sign up failed");
        setLoading(false);
        return;
      }
      router.push("/login?registered=1");
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
          <Link href="/app" className="flex items-center justify-center gap-2 text-fern-900 mb-4">
            <Image src="/doorstep/DL_icon_RGB.svg" alt="" width={48} height={48} className="h-12 w-auto" unoptimized />
            <Image src="/doorstep/doorstep-logo-wordmark.svg" alt="Doorstep" width={120} height={32} className="h-8 w-auto" unoptimized />
          </Link>
          <Image src="/doorstep/doorstep-logo-subtext.svg" alt="" width={160} height={40} className="h-10 w-auto opacity-90" unoptimized />
          <h1 className="mt-6 text-2xl font-semibold text-fern-900">
            Create account
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label htmlFor="name" className={labelClass}>
              Name (optional)
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
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
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
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
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>
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
            Sign up with Google
          </button>
        )}
        <p className="text-center text-xs text-fern-500 leading-relaxed">
          By creating an account you agree to our{" "}
          <Link href="/legal/terms" className="underline hover:text-fern-700">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/legal/privacy" className="underline hover:text-fern-700">Privacy Policy</Link>.
        </p>
        <p className="text-center text-sm text-fern-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-fern-600 hover:text-fern-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
