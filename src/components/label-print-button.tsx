"use client";

import { useState } from "react";

type Status = "idle" | "printing" | "printed" | "error";

type Props = {
  orderNumber: string;
  loadNumber: number;
  numberOfLoads: number;
  className?: string;
  buttonLabel?: string;
};

/**
 * Taps /api/driver/print-label.
 *
 * If LABEL_PRINTER_URL is set on the server and the printer is reachable →
 * sends via IPP (image/png), shows "Sent ✓".
 *
 * Otherwise → receives the PNG and opens the browser print dialog
 * (AirPrint on iOS / Mopria on Android) via a hidden iframe.
 */
export function LabelPrintButton({
  orderNumber,
  loadNumber,
  numberOfLoads,
  className,
  buttonLabel,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");

  const label = buttonLabel ?? `L${loadNumber}`;

  async function handlePrint() {
    if (status === "printing") return;
    setStatus("printing");

    try {
      const res = await fetch("/api/driver/print-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, loadNumber, numberOfLoads }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as
        | { status: "printed" }
        | { status: "png"; data: string };

      if (json.status === "printed") {
        setStatus("printed");
        setTimeout(() => setStatus("idle"), 2500);
        return;
      }

      // AirPrint fallback: embed the PNG in a minimal print page sized to the
      // label (62mm × 35mm) and open the system print dialog via an iframe.
      const imgSrc = `data:image/png;base64,${json.data}`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { size: 62mm 35mm; margin: 0; }
  html, body { margin: 0; padding: 0; width: 62mm; height: 35mm; overflow: hidden; }
  img { width: 62mm; height: 35mm; display: block; }
</style></head><body><img src="${imgSrc}"/></body></html>`;

      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none;";
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => iframe.remove(), 1000);
        }, 150);
      } else {
        iframe.remove();
      }

      setStatus("printed");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      console.error("[LabelPrintButton]", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const text =
    status === "printing"
      ? "..."
      : status === "printed"
        ? "Sent ✓"
        : status === "error"
          ? "Error"
          : label;

  return (
    <button
      type="button"
      onClick={() => void handlePrint()}
      disabled={status === "printing"}
      className={className}
    >
      {text}
    </button>
  );
}
