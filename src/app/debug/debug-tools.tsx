"use client";

import { useState } from "react";

export function DebugTools() {
  const [smsTo, setSmsTo] = useState("");
  const [smsMessage, setSmsMessage] = useState("Test from Doorstep Debug");
  const [smsResult, setSmsResult] = useState<string | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);

  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("Test from Doorstep Debug");
  const [emailBody, setEmailBody] = useState("This is a test email.");
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const [routeInput, setRouteInput] = useState("");
  const [routeResult, setRouteResult] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [printOrderNumber, setPrintOrderNumber] = useState("ORDER-20260702-0001");
  const [printLoadNumber, setPrintLoadNumber] = useState(1);
  const [printNumberOfLoads, setPrintNumberOfLoads] = useState(1);
  const [printResult, setPrintResult] = useState<string | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  async function sendSms() {
    setSmsResult(null);
    setSmsLoading(true);
    try {
      const res = await fetch("/api/debug/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: smsTo, message: smsMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSmsResult(`Sent (id: ${data.id ?? "—"})`);
      else setSmsResult(`Error: ${data.error ?? res.statusText}`);
    } catch (e) {
      setSmsResult(`Error: ${(e as Error).message}`);
    } finally {
      setSmsLoading(false);
    }
  }

  async function sendEmail() {
    setEmailResult(null);
    setEmailLoading(true);
    try {
      const res = await fetch("/api/debug/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setEmailResult(`Sent (id: ${data.id ?? "—"})`);
      else setEmailResult(`Error: ${data.error ?? res.statusText}`);
    } catch (e) {
      setEmailResult(`Error: ${(e as Error).message}`);
    } finally {
      setEmailLoading(false);
    }
  }

  async function sendPrint() {
    setPrintResult(null);
    setPrintLoading(true);
    try {
      const res = await fetch("/api/print-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: printOrderNumber,
          loadNumber: printLoadNumber,
          numberOfLoads: printNumberOfLoads,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPrintResult(`Sent (jobId: ${data.jobId ?? "—"})`);
        setTimeout(() => setPrintResult(null), 3_000);
      } else {
        setPrintResult(`Error: ${data.error ?? res.statusText}`);
      }
    } catch (e) {
      setPrintResult(`Error: ${(e as Error).message}`);
    } finally {
      setPrintLoading(false);
    }
  }

  async function optimizeRoute() {
    setRouteResult(null);
    setRouteLoading(true);
    const addresses = routeInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (addresses.length < 2) {
      setRouteResult("Enter at least 2 addresses (one per line or comma-separated).");
      setRouteLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/debug/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.addresses)) {
        setRouteResult("Optimized order:\n" + data.addresses.map((a: string, i: number) => `${i + 1}. ${a}`).join("\n"));
      } else {
        setRouteResult(`Error: ${data.error ?? res.statusText}`);
      }
    } catch (e) {
      setRouteResult(`Error: ${(e as Error).message}`);
    } finally {
      setRouteLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-fern-900 mb-3">Quo – Test SMS</h2>
        <p className="text-sm text-fern-600 mb-4">
          Send a test SMS using your configured Quo number.
        </p>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-fern-700 mb-1">To (E.164)</label>
            <input
              type="text"
              value={smsTo}
              onChange={(e) => setSmsTo(e.target.value)}
              placeholder="+15551234567"
              className="w-full rounded-lg border border-fern-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fern-700 mb-1">Message</label>
            <textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-fern-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={sendSms}
            disabled={smsLoading}
            className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50"
          >
            {smsLoading ? "Sending…" : "Send test SMS"}
          </button>
          {smsResult && (
            <p className="text-sm text-fern-700 whitespace-pre-wrap">{smsResult}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-fern-900 mb-3">Resend – Test email</h2>
        <p className="text-sm text-fern-600 mb-4">
          Send a test email using your configured Resend from address.
        </p>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-fern-700 mb-1">To</label>
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-fern-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fern-700 mb-1">Subject</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full rounded-lg border border-fern-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fern-700 mb-1">Body</label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-fern-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={sendEmail}
            disabled={emailLoading}
            className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50"
          >
            {emailLoading ? "Sending…" : "Send test email"}
          </button>
          {emailResult && (
            <p className="text-sm text-fern-700 whitespace-pre-wrap">{emailResult}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-fern-900 mb-3">Label printer – test print</h2>
        <p className="text-sm text-fern-600 mb-4">
          Queue a label print job exactly as the wash page does. Any Android device running
          PrintQueueService with a paired printer will pick it up.
        </p>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-fern-700 mb-1">Order number</label>
            <input
              type="text"
              value={printOrderNumber}
              onChange={(e) => setPrintOrderNumber(e.target.value)}
              placeholder="ORDER-20260702-0001"
              className="w-full rounded-lg border border-fern-200 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-fern-700 mb-1">Load #</label>
              <input
                type="number"
                min={1}
                value={printLoadNumber}
                onChange={(e) => setPrintLoadNumber(Number(e.target.value))}
                className="w-full rounded-lg border border-fern-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-fern-700 mb-1">Total loads</label>
              <input
                type="number"
                min={1}
                value={printNumberOfLoads}
                onChange={(e) => setPrintNumberOfLoads(Number(e.target.value))}
                className="w-full rounded-lg border border-fern-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={sendPrint}
            disabled={printLoading}
            className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50"
          >
            {printLoading ? "Sending…" : "Send test print"}
          </button>
          {printResult && (
            <p className="text-sm text-fern-700 whitespace-pre-wrap">{printResult}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-fern-900 mb-3">Route optimization</h2>
        <p className="text-sm text-fern-600 mb-4">
          Enter addresses (one per line or comma-separated). Uses Google Directions API with waypoint optimization.
        </p>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-fern-700 mb-1">Addresses</label>
            <textarea
              value={routeInput}
              onChange={(e) => setRouteInput(e.target.value)}
              placeholder={"123 Main St, City, ST 12345\n456 Oak Ave, Town, ST 67890"}
              rows={5}
              className="w-full rounded-lg border border-fern-200 px-3 py-2 text-sm font-mono"
            />
          </div>
          <button
            type="button"
            onClick={optimizeRoute}
            disabled={routeLoading}
            className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50"
          >
            {routeLoading ? "Optimizing…" : "Optimize route"}
          </button>
          {routeResult && (
            <pre className="text-sm text-fern-700 whitespace-pre-wrap bg-fern-50 p-3 rounded-lg">
              {routeResult}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}
