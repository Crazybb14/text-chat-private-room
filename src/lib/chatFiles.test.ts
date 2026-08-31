import { describe, it, expect } from "vitest";
import { MAX_CHAT_FILE_BYTES, validateChatFile } from "./chatFiles";

const file = (name: string): File => new File(["x".repeat(4)], name, { type: "text/plain" });

// @kliv-spec-derived — "send files right next to the message bar" means normal files pass, broken ones don't
describe("validateChatFile", () => {
  it("accepts a normal file", () => {
    expect(validateChatFile(file("notes.txt"))).toEqual({ ok: true });
  });

  it("rejects files over the 500 MB ceiling", () => {
    const tooBig = new File(["x"], "huge.zip");
    Object.defineProperty(tooBig, "size", { value: MAX_CHAT_FILE_BYTES + 1 });
    const result = validateChatFile(tooBig);
    expect(result.ok).toBe(false);
  });

  it("rejects empty files", () => {
    const empty = new File([], "empty.txt");
    Object.defineProperty(empty, "size", { value: 0 });
    const result = validateChatFile(empty);
    expect(result.ok).toBe(false);
  });
});
