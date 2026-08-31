import { describe, it, expect } from "vitest";
import { crc32 } from "./websiteZip";

// @kliv-spec-derived — the CRC-32 check value for "123456789" is defined by the
// CRC-32 standard (IEEE 802.3) as 0xCBF43926, independent of this implementation.
describe("crc32", () => {
  it("matches the standard check value for 123456789", () => {
    const bytes = new TextEncoder().encode("123456789");
    expect(crc32(bytes)).toBe(0xcbf43926);
  });

  it("returns 0 for an empty input", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});
