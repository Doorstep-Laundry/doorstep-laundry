"use client";

import { useCallback, useState } from "react";
import QRCode from "qrcode";
import { tagPrintLines, tagQrPayload } from "@/lib/load-tag";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Props = {
  orderNumber: string;
  loadNumber: number;
  numberOfLoads: number;
  className?: string;
  buttonLabel?: string;
};

/**
 * Opens a 50mm×30mm print view: line 1 = `YYYYMMDD-`, line 2 = `{seq} L{n} / {total}` + QR bottom-right.
 */
export function LoadTagPrintButton({
  orderNumber,
  loadNumber,
  numberOfLoads,
  className,
  buttonLabel = "Print tag",
}: Props) {
  const handlePrint = useCallback(() => {
    void (async () => {
      if (typeof document === "undefined") return;

      const payload = tagQrPayload(orderNumber, loadNumber, numberOfLoads);
      const { line1, line2 } = tagPrintLines(
        orderNumber,
        loadNumber,
        numberOfLoads
      );

      let qrSvg: string;
      try {
        qrSvg = await QRCode.toString(payload, {
          type: "svg",
          margin: 0,
          width: 240,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        });
      } catch (e) {
        console.error("[LoadTagPrint] QR render failed:", e);
        return;
      }

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: 50mm 30mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  .tag {
    width: 50mm;
    height: 30mm;
    position: relative;
    padding: 1mm 1.2mm;
    overflow: hidden;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .text-block {
    position: absolute;
    top: 1mm;
    left: 1.2mm;
    right: 20.5mm;
    bottom: 1mm;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
  }
  .line1 {
    font-size: 11pt;
    line-height: 1.12;
    font-weight: 800;
    word-break: break-all;
    max-width: 100%;
  }
  .line2 {
    font-size: 10pt;
    line-height: 1.12;
    font-weight: 700;
    margin-top: 1mm;
  }
  .qr-wrap {
    position: absolute;
    right: 0.8mm;
    bottom: 0.8mm;
    width: 19.5mm;
    height: 19.5mm;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .qr-wrap svg {
    width: 100% !important;
    height: 100% !important;
    max-width: 100%;
    max-height: 100%;
    display: block;
  }
</style></head>
<body>
  <div class="tag">
    <div class="text-block">
      <div class="line1">${escapeHtml(line1)}</div>
      <div class="line2">${escapeHtml(line2)}</div>
    </div>
    <div class="qr-wrap">${qrSvg}</div>
  </div>
</body></html>`;

      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument;
      if (!doc) {
        iframe.remove();
        return;
      }
      doc.open();
      doc.write(html);
      doc.close();

      const win = iframe.contentWindow;
      if (!win) {
        iframe.remove();
        return;
      }

      win.focus();
      setTimeout(() => {
        win.print();
        setTimeout(() => iframe.remove(), 800);
      }, 100);
    })();
  }, [orderNumber, loadNumber, numberOfLoads]);

  return (
    <button type="button" onClick={handlePrint} className={className}>
      {buttonLabel}
    </button>
  );
}

type AndroidLinkProps = {
  orderNumber: string;
  loadNumber: number;
  numberOfLoads: number;
  className?: string;
  buttonLabel?: string;
};

type SendToZebraProps = {
  orderNumber: string;
  loadNumber: number;
  numberOfLoads: number;
  className?: string;
  buttonLabel?: string;
};

/**
 * Sends a print job to the Android relay device via the webapp print queue API.
 * The Android device's PrintQueueService picks it up and prints via Bluetooth.
 */
export function LoadTagSendToZebraButton({
  orderNumber,
  loadNumber,
  numberOfLoads,
  className,
  buttonLabel = "Send to Zebra",
}: SendToZebraProps) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSend = useCallback(() => {
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
    <button type="button" onClick={handleSend} disabled={state === "sending"} className={className}>
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
}: AndroidLinkProps) {
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
