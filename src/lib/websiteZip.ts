import { SITE_SNAPSHOT, SITE_SNAPSHOT_DATE } from "./siteSnapshot";

export { SITE_SNAPSHOT_DATE };

/** CRC-32 (IEEE 802.3) over a byte array. */
export function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

interface ZipEntry {
  name: string;
  crc: number;
  size: number;
  data: Uint8Array;
  offset: number;
}

/**
 * Builds a ZIP archive (stored, uncompressed) from name->base64 contents.
 * Pure client-side: no compression library needed.
 */
export function buildWebsiteZip(): Blob {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  let offset = 0;

  const parts: Uint8Array[] = [];

  const write = (...chunks: (string | Uint8Array)[]) => {
    for (const chunk of chunks) {
      parts.push(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
    }
  };

  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
  const u32 = (v: number) =>
    new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]);

  const names = Object.keys(SITE_SNAPSHOT).sort();
  for (const name of names) {
    const data = base64ToBytes(SITE_SNAPSHOT[name]);
    const crc = crc32(data);
    const nameBytes = encoder.encode(name);

    write(
      "PK\x03\x04",
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(33),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data
    );

    entries.push({ name, crc, size: data.length, data, offset });
    offset += 30 + nameBytes.length + data.length;
  }

  const cdStart = offset;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    write(
      "PK\x01\x02",
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(33),
      u32(entry.crc),
      u32(entry.size),
      u32(entry.size),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(entry.offset),
      nameBytes
    );
    offset += 46 + nameBytes.length;
  }
  const cdSize = offset - cdStart;

  write(
    "PK\x05\x06",
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(cdSize),
    u32(cdStart),
    u16(0)
  );

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return new Blob([out], { type: "application/zip" });
}

/** Builds the ZIP and triggers a browser download. */
export function downloadWebsiteZip(): void {
  const blob = buildWebsiteZip();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "website-source.zip";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
