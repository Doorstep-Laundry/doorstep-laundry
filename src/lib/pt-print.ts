/**
 * Brother PT-Touch raster protocol over raw TCP (port 9100).
 *
 * Key design: after sending ESC @ (init), the QL-820NWB automatically
 * returns a 32-byte status packet describing the loaded roll (width, type,
 * length from the roll's RFID chip). We read those bytes and echo the exact
 * same values back in the ESC i z (set media) command so the printer's
 * validation always passes — regardless of which DK roll is loaded.
 */
import net from "net";
import sharp from "sharp";

// QL-820NWB at 300 DPI: DK-2205 (62 mm tape) = 720 printable dots = 90 bytes/row
export const PT_DOTS_W = 720;
const BYTES_PER_ROW = PT_DOTS_W / 8; // 90

// ---------------------------------------------------------------------------
// Image → raster conversion
// ---------------------------------------------------------------------------

async function pngToRasterRows(png: Buffer, dotH: number): Promise<Buffer[]> {
  const { data: raw } = await sharp(png)
    .resize(PT_DOTS_W, dotH, { fit: "contain", background: "white" })
    .flatten({ background: "white" })
    .grayscale()
    .threshold(128)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rows: Buffer[] = [];
  for (let r = 0; r < dotH; r++) {
    const row = Buffer.alloc(BYTES_PER_ROW, 0);
    let hasInk = false;
    for (let c = 0; c < PT_DOTS_W; c++) {
      if (raw[r * PT_DOTS_W + c] === 0) {
        row[c >> 3] |= 1 << (7 - (c & 7));
        hasInk = true;
      }
    }
    rows.push(hasInk ? row : Buffer.alloc(0));
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Packet builder (called after we know the actual media values from status)
// ---------------------------------------------------------------------------

interface MediaInfo {
  type: number;   // byte 11 of status packet
  width: number;  // byte 10 — mm
  length: number; // byte 17 — mm (0 = continuous)
}

function buildPrintPacket(rows: Buffer[], media: MediaInfo): Buffer {
  const n = rows.length;
  const parts: Buffer[] = [];

  // ESC i a 01 — switch to raster graphics mode
  parts.push(Buffer.from([0x1b, 0x69, 0x61, 0x01]));

  // ESC i z — set media and quality using the printer's own reported values.
  // PI_RECOVER(0x80) | PI_QUALITY(0x40) | PI_KIND(0x02) | PI_WIDTH(0x04) = 0xC6
  // PI_LENGTH(0x08) added only for die-cut rolls (non-zero length).
  const flags = media.length > 0 ? 0xce : 0xc6;
  parts.push(Buffer.from([
    0x1b, 0x69, 0x7a,
    flags,
    media.type,          // echoed from printer status
    media.width,         // echoed from printer status
    media.length,        // echoed from printer status
    (n) & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff,
    0x00,
  ]));

  // ESC i M 40 — auto-cut after each label
  parts.push(Buffer.from([0x1b, 0x69, 0x4d, 0x40]));

  // ESC i A 01 — cut each 1 label
  parts.push(Buffer.from([0x1b, 0x69, 0x41, 0x01]));

  // ESC i d 00 00 — extra margin: 0 dots
  parts.push(Buffer.from([0x1b, 0x69, 0x64, 0x00, 0x00]));

  // Raster lines: 0x5A = blank row, 0x47 lo hi data... = inked row
  for (const row of rows) {
    if (row.length === 0) {
      parts.push(Buffer.from([0x5a]));
    } else {
      const cmd = Buffer.allocUnsafe(3 + BYTES_PER_ROW);
      cmd[0] = 0x47;
      cmd[1] = BYTES_PER_ROW;
      cmd[2] = 0x00;
      row.copy(cmd, 3);
      parts.push(cmd);
    }
  }

  // Print and cut
  parts.push(Buffer.from([0x1a]));

  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Print a PNG label to a Brother QL printer via PT-Touch raster over TCP.
 * @param host  Printer IP address
 * @param port  Raw print port (Brother QL default: 9100)
 * @param png   Label PNG at any size; resized+dithered to 720 × dotH internally
 * @param dotH  Label height in dots at 300 DPI (35 mm → 413 dots)
 */
export async function printLabelTcp(
  host: string,
  port: number,
  png: Buffer,
  dotH: number
): Promise<void> {
  const rows = await pngToRasterRows(png, dotH);

  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });

    const hardTimer = setTimeout(() => {
      sock.destroy();
      reject(new Error("Printer TCP hard timeout (12 s)"));
    }, 12_000);

    const done = (err?: Error) => {
      clearTimeout(hardTimer);
      sock.destroy();
      err ? reject(err) : resolve();
    };

    // Phase 1: wait for the 32-byte status the printer sends after ESC @
    let phase: "awaiting-status" | "printing" = "awaiting-status";
    let rxBuf = Buffer.alloc(0);

    sock.on("data", (chunk: Buffer) => {
      rxBuf = Buffer.concat([rxBuf, chunk]);

      if (phase === "awaiting-status" && rxBuf.length >= 32) {
        phase = "printing";

        // Extract actual media info from the printer's own RFID reading
        const media: MediaInfo = {
          width:  rxBuf[10],
          type:   rxBuf[11],
          length: rxBuf[17],
        };

        console.log(
          `[pt-print] Printer status — width: ${media.width} mm, ` +
          `type: 0x${media.type.toString(16)}, length: ${media.length} mm`
        );

        // Error bytes: byte 8 = error 1, byte 9 = error 2
        if (rxBuf[8] !== 0 || rxBuf[9] !== 0) {
          done(
            new Error(
              `[pt-print] Printer error before print: ` +
              `err1=0x${rxBuf[8].toString(16)} err2=0x${rxBuf[9].toString(16)}`
            )
          );
          return;
        }

        const packet = buildPrintPacket(rows, media);
        sock.write(packet, (err) => {
          if (err) { done(err); return; }
          // Allow the printer time to render and cut (300 DPI, ~413 lines)
          setTimeout(() => done(), 3000);
        });

        rxBuf = Buffer.alloc(0);
      }
    });

    sock.on("connect", () => {
      // Invalidate + ESC @ (init) + ESC i S (explicit status request).
      // The QL-820NWB does NOT auto-send status after init — ESC i S is required.
      const initCmd = Buffer.concat([
        Buffer.alloc(200, 0x00),        // invalidate
        Buffer.from([0x1b, 0x40]),       // ESC @ — reset
        Buffer.from([0x1b, 0x69, 0x53]), // ESC i S — status request
      ]);
      sock.write(initCmd);
    });

    sock.on("error", done);
  });
}
