"use client";

import { useState, useEffect } from "react";

export function AdminPastDueGracePeriod() {
  const [days, setDays] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { credentials: "same-origin" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        const value =
          typeof data.pastDueGracePeriodDays === "number" && Number.isFinite(data.pastDueGracePeriodDays)
            ? data.pastDueGracePeriodDays
            : 3;
        setDays(value);
        setInputValue(String(value));
      })
      .catch(() => {
        setDays(3);
        setInputValue("3");
        setMessage("Could not load settings.");
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInt(inputValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setMessage("Enter a valid whole number (0 or more).");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastDueGracePeriodDays: parsed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Failed to save.");
        return;
      }
      setDays(parsed);
      setMessage("Saved.");
    } catch {
      setMessage("Request failed.");
    } finally {
      setSaving(false);
    }
  }

  if (days === null) return <p className="text-sm text-fern-500">Loading…</p>;

  return (
    <form onSubmit={handleSave} className="flex flex-wrap items-center gap-3">
      <label htmlFor="admin-past-due-grace-period" className="text-sm font-medium text-fern-700">
        Grace period (days)
      </label>
      <input
        id="admin-past-due-grace-period"
        type="number"
        min="0"
        step="1"
        value={inputValue}
        onChange={(e) => { setInputValue(e.target.value); setMessage(null); }}
        className="rounded-lg border border-fern-300 px-3 py-2 text-sm text-fern-900 w-24 focus:outline-none focus:ring-2 focus:ring-fern-500/20 focus:border-fern-500"
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-fern-600 text-white px-4 py-2 text-sm font-medium hover:bg-fern-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {message && (
        <span className={`text-sm ${message === "Saved." ? "text-fern-600" : "text-red-600"}`}>
          {message}
        </span>
      )}
    </form>
  );
}
