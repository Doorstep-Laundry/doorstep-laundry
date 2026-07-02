"use client";

import { useState } from "react";
import { isValidPhone } from "@/lib/phone";

const inputClass =
  "mt-1 block w-full rounded-lg border border-fern-200 bg-white px-3 py-2.5 text-fern-900 placeholder-fern-400 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20 transition-colors";
const labelClass = "block text-sm font-medium text-fern-700";


export function AccountForm({
  name,
  email,
  phone,
  smsConsentAt,
}: {
  name: string;
  email: string;
  phone: string;
  smsConsentAt: Date | null;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name, email, phone });
  const [smsConsent, setSmsConsent] = useState(smsConsentAt !== null);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentMessage, setConsentMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.phone.trim() !== "" && !isValidPhone(form.phone)) {
      setMessage("Please enter a valid 10-digit US phone number (e.g. 505-123-4567).");
      return;
    }
    if (form.phone.trim() !== "" && !smsConsent) {
      setMessage("Please check the box to agree to SMS updates before saving your phone number.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Failed to update");
        setSaving(false);
        return;
      }
      setMessage("Saved.");
      setSaving(false);
    } catch {
      setMessage("Something went wrong");
      setSaving(false);
    }
  }

  async function handleConsentChange(checked: boolean) {
    if (checked) {
      if (form.phone.trim() === "") {
        setConsentMessage("Enter a phone number first.");
        return;
      }
      if (!isValidPhone(form.phone)) {
        setConsentMessage("Enter a valid phone number first.");
        return;
      }
    }
    setSmsConsent(checked);
    setConsentSaving(true);
    setConsentMessage("");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          checked
            ? { phone: form.phone, smsConsent: true }
            : { phone: "", smsConsent: false }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConsentMessage(data.error ?? "Failed to save.");
        setSmsConsent(!checked);
      } else {
        if (!checked) setForm((f) => ({ ...f, phone: "" }));
        setConsentMessage(checked ? "SMS updates enabled." : "SMS updates disabled.");
      }
    } catch {
      setConsentMessage("Something went wrong.");
      setSmsConsent(!checked);
    } finally {
      setConsentSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {message && (
        <p className="text-sm text-fern-600">{message}</p>
      )}
      <div>
        <label className={labelClass}>
          Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>
          Email
        </label>
        <input
          type="email"
          value={form.email}
          readOnly
          className="mt-1 block w-full rounded-lg border border-fern-200 bg-fern-50 px-3 py-2.5 text-fern-500"
        />
        <p className="text-xs text-fern-500 mt-1">Email cannot be changed here.</p>
      </div>
      <div>
        <label className={labelClass}>
          Phone (for SMS updates)
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => {
            const next = e.target.value;
            setForm((f) => ({ ...f, phone: next }));
            if (next.trim() === "") setSmsConsent(false);
          }}
          placeholder="+1 (505)-123-4567"
          className={inputClass}
          aria-invalid={form.phone.trim() !== "" && !isValidPhone(form.phone)}
        />
        <p className="text-xs text-fern-500 mt-1">10-digit US number. Leave blank for no SMS.</p>
        <div className="mt-3 flex gap-2.5 items-start">
          <input
            id="account-sms-consent"
            type="checkbox"
            checked={smsConsent}
            disabled={consentSaving}
            onChange={(e) => handleConsentChange(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-fern-300 text-fern-600 focus:ring-fern-500 disabled:opacity-50"
          />
          <label htmlFor="account-sms-consent" className="text-sm text-fern-700 leading-snug cursor-pointer">
            By checking this box and providing your phone number, you agree to receive order status
            updates via SMS from Doorstep Laundry. Message and data rates may apply. Reply STOP to
            unsubscribe. See our{" "}
            <a href="/legal/sms" className="underline hover:text-fern-900">SMS Policy</a>.
          </label>
        </div>
        {consentMessage && (
          <p className="mt-1.5 text-xs text-fern-600">{consentMessage}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
