import { describe, expect, it } from "vitest";
import {
  fileKind,
  fileVisibleToViewer,
  formatBytes,
  isFileApproved,
  MAX_DM_FILE_BYTES,
  validateDmFile,
} from "./dmFiles";

function makeFile(_size: number, name = "movie.mp4", type = "video/mp4"): File {
  return new File(["x"], name, { type });
}

// @kliv-spec-derived — from user intent: "files in private chats, any type, under the cap"
describe("validateDmFile", () => {
  it("accepts any file type under the limit", () => {
    const cases = [
      makeFile(1024, "notes.txt", "text/plain"),
      makeFile(5 * 1024 * 1024, "song.mp3", "audio/mpeg"),
      makeFile(10 * 1024 * 1024, "report.pdf", "application/pdf"),
      makeFile(100 * 1024 * 1024, "video.mp4", "video/mp4"),
    ];
    for (const file of cases) {
      Object.defineProperty(file, "size", { value: file.size });
      expect(validateDmFile(file).ok).toBe(true);
    }
  });

  it("rejects files larger than the platform's 500 MB upload cap", () => {
    const file = makeFile(0, "huge.mkv");
    Object.defineProperty(file, "size", { value: MAX_DM_FILE_BYTES + 1 });
    const result = validateDmFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("500 MB");
  });

  it("rejects empty files with a readable reason", () => {
    const file = makeFile(0, "empty.bin");
    Object.defineProperty(file, "size", { value: 0 });
    const result = validateDmFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("empty");
  });
});

// code-consistent — media kinds decide whether a file plays in the page
describe("fileKind", () => {
  it("maps common mime types", () => {
    expect(fileKind("image/png")).toBe("image");
    expect(fileKind("video/webm")).toBe("video");
    expect(fileKind("audio/ogg")).toBe("audio");
    expect(fileKind("application/zip")).toBe("other");
    expect(fileKind("")).toBe("other");
  });
});

describe("formatBytes", () => {
  it("formats sizes people can read", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(460 * 1024 * 1024)).toBe("460 MB");
  });
});

// @kliv-spec-derived — from user intent: "all files have to get approved by admin"
describe("file approval", () => {
  it("treats only approved files as visible to everyone", () => {
    expect(isFileApproved("approved")).toBe(true);
    expect(isFileApproved("pending")).toBe(false);
    expect(isFileApproved(null)).toBe(false);
    expect(isFileApproved(undefined)).toBe(false);
  });

  it("lets the sender see their own file while it waits, but nobody else", () => {
    expect(fileVisibleToViewer("pending", true)).toBe(true);
    expect(fileVisibleToViewer("pending", false)).toBe(false);
    expect(fileVisibleToViewer("approved", false)).toBe(true);
    expect(fileVisibleToViewer(null, false)).toBe(false);
  });
});
