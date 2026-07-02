"use client";

import { useCallback, useState } from "react";

type Props = {
  orderNumber: string;
  loadNumber: number;
  numberOfLoads: number;
  className?: string;
  buttonLabel?: string;
};

/**
 * Submits a print job to the server queue; any Android device running
 * PrintQueueService with a paired printer will pick it up and print via BT.
 */
export function LoadTagPrintButton({
  orderNumber,
  loadNumber,
  numberOfLoads,
  className,
  buttonLabel = "Print tag",
}: Props) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handlePrint = useCallback(() => {
    setState("sending");
    void fetch("/api/print-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber, loadNumber, numberOfLoads }),
    })
      .then((res) => {
        setState(res.ok ? "sent" : "error");
        if (res.ok) setTimeout(() => setState("idle"), 3_000);
      })
      .catch(() => setState("error"));
  }, [orderNumber, loadNumber, numberOfLoads]);

  const label =
    state === "sending" ? "Sending…"
    : state === "sent" ? "Sent ✓"
    : state === "error" ? "Failed — retry?"
    : buttonLabel;

  return (
    <button type="button" onClick={handlePrint} disabled={state === "sending"} className={className}>
      {label}
    </button>
  );
}

/**
 * Renders an anchor that fires the doorstep://print deep link on Android tablets.
 * The native app handles the intent, prints the label, and returns focus to Chrome.
 */
export function LoadTagAndroidPrintLink({
  orderNumber,
  loadNumber,
  numberOfLoads,
  className,
  buttonLabel = "Print tag (Android)",
}: Props) {
  const params = new URLSearchParams({
    orderNumber,
    loadNumber: String(loadNumber),
    numberOfLoads: String(numberOfLoads),
  });
  const href = `doorstep://print?${params.toString()}`;

  return (
    <a href={href} className={className}>
      {buttonLabel}
    </a>
  );
}
