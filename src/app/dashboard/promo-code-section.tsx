"use client";

import { useState } from "react";
import { CreditedLoadsBanner } from "@/components/credited-loads-banner";

type Props = { initialCreditedLoads: number };

export function PromoCodeSection({ initialCreditedLoads }: Props) {
  const [creditedLoads, setCreditedLoads] = useState(initialCreditedLoads);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function redeem() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/promo-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: data.error ?? "Failed to redeem code.", ok: false });
      } else {
        setCreditedLoads(data.creditedLoads ?? creditedLoads + (data.loadsAdded ?? 0));
        setCode("");
        setMessage({
          text: `Code applied! ${data.loadsAdded} free load${data.loadsAdded === 1 ? "" : "s"} added to your account.`,
          ok: true,
        });
      }
    } catch {
      setMessage({ text: "Something went wrong.", ok: false });
    }
    setSubmitting(false);
  }

  return (
    <>
      <CreditedLoadsBanner creditedLoads={creditedLoads} />
      <div className="mb-6 flex items-center gap-2 max-w-sm">
        <input
          type="text"
          placeholder="Enter promo code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && redeem()}
          maxLength={16}
          className="rounded-lg border border-fern-200 bg-white px-3 py-2 text-sm text-fern-900 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20 flex-1 font-mono uppercase tracking-widest"
          aria-label="Promo code"
        />
        <button
          type="button"
          onClick={redeem}
          disabled={submitting || !code.trim()}
          className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50 whitespace-nowrap"
        >
          {submitting ? "Applying…" : "Apply"}
        </button>
      </div>
      {message && (
        <p className={`text-sm mb-4 -mt-4 ${message.ok ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </>
  );
}
