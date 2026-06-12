/**
 * Minimal IPP/1.1 "Print-Job" client — no external dependencies.
 * Sends a PDF buffer to any AirPrint-compatible IPP printer (including Brother QL-820NWB).
 *
 * Usage:
 *   await sendLabelToPrinter("http://192.168.111.1:631/ipp/print", pdfBytes)
 *
 * The printer URL uses http:// even though the protocol is called ipp://.
 * IPP runs over plain HTTP on port 631.
 */

// IPP value-tag constants
const TAG = {
  CHARSET: 0x47,
  NATURAL_LANGUAGE: 0x48,
  URI: 0x45,
  NAME: 0x42,
  MIME: 0x49,
} as const;

function encodeAttr(tag: number, name: string, value: string): Buffer {
  const nameBuf = Buffer.from(name, "ascii");
  const valBuf = Buffer.from(value, "utf8");
  const out = Buffer.allocUnsafe(1 + 2 + nameBuf.length + 2 + valBuf.length);
  let offset = 0;
  out.writeUInt8(tag, offset++);
  out.writeUInt16BE(nameBuf.length, offset);
  offset += 2;
  nameBuf.copy(out, offset);
  offset += nameBuf.length;
  out.writeUInt16BE(valBuf.length, offset);
  offset += 2;
  valBuf.copy(out, offset);
  return out;
}

function buildPrintJobRequest(printerUri: string, pdf: Uint8Array): Buffer {
  const header = Buffer.from([
    0x01, 0x01, // IPP version 1.1
    0x00, 0x02, // operation: Print-Job
    0x00, 0x00, 0x00, 0x01, // request-id: 1
    0x01, // begin operation-attributes-tag
  ]);

  const attrs = Buffer.concat([
    encodeAttr(TAG.CHARSET, "attributes-charset", "utf-8"),
    encodeAttr(TAG.NATURAL_LANGUAGE, "attributes-natural-language", "en"),
    encodeAttr(TAG.URI, "printer-uri", printerUri.replace(/^http/, "ipp")),
    encodeAttr(TAG.NAME, "requesting-user-name", "driver"),
    encodeAttr(TAG.NAME, "job-name", "load-tag"),
    encodeAttr(TAG.MIME, "document-format", "image/png"),
  ]);

  const endTag = Buffer.from([0x03]); // end-of-attributes
  return Buffer.concat([header, attrs, endTag, Buffer.from(pdf)]);
}

export async function sendLabelToPrinter(
  printerHttpUrl: string,
  pdf: Uint8Array
): Promise<void> {
  const body = buildPrintJobRequest(printerHttpUrl, pdf);

  const res = await fetch(printerHttpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/ipp",
      "Content-Length": String(body.length),
    },
    body: new Uint8Array(body),
    // 5-second timeout — vehicle WiFi should be fast but let's not hang
    signal: AbortSignal.timeout(5000),
  });

  // IPP always responds 200 OK at the HTTP level; status is in bytes 2-3
  if (!res.ok) {
    throw new Error(`IPP HTTP error ${res.status}`);
  }

  const respBuf = Buffer.from(await res.arrayBuffer());
  if (respBuf.length >= 4) {
    const ippStatus = respBuf.readUInt16BE(2);
    // 0x0000–0x00ff = success range (successful-ok and ok-with-warnings)
    if (ippStatus > 0x00ff) {
      throw new Error(`IPP error status 0x${ippStatus.toString(16)}`);
    }
  }
}
