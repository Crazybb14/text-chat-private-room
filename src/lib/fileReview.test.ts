import { describe, expect, it } from "vitest";
import { fileTimestamp, splitByStatus, toReviewableFiles } from "./fileReview";
import type { ReviewableDmFile, ReviewableRoomFile } from "./fileReview";

const roomFile = (over: Partial<ReviewableRoomFile> = {}): ReviewableRoomFile => ({
  _row_id: 1,
  room_id: 2,
  sender_name: "alex",
  file_path: "/content/chat_files/2/a.txt",
  file_name: "a.txt",
  file_size: 10,
  mime_type: "text/plain",
  file_status: "pending",
  _created_at: 100,
  ...over,
});

const dmFile = (over: Partial<ReviewableDmFile> = {}): ReviewableDmFile => ({
  _row_id: 5,
  sender_username: "alex",
  recipient_username: "sam",
  file_path: "/content/dm_files/b.txt",
  file_name: "b.txt",
  file_size: 20,
  mime_type: "text/plain",
  status: "pending",
  _created_at: 200,
  ...over,
});

// @kliv-spec-derived — from user intent: an admin reviews every file sent on the site
describe("toReviewableFiles", () => {
  it("combines room attachments and private files into one list", () => {
    const rooms = new Map([[2, "Hangout"]]);
    const files = toReviewableFiles([roomFile()], [dmFile()], rooms);
    expect(files).toHaveLength(2);
    expect(files[0].name).toBe("b.txt"); // newest first
    expect(files[0].where).toBe("alex → sam");
    expect(files[1].where).toBe("Hangout");
  });

  it("ignores plain text messages that carry no file", () => {
    const files = toReviewableFiles([roomFile({ file_path: null })], [], new Map());
    expect(files).toHaveLength(0);
  });
});

describe("splitByStatus", () => {
  it("keeps waiting files apart from live ones until they are approved", () => {
    const rooms = new Map<number, string>();
    const files = toReviewableFiles(
      [roomFile({ file_status: "approved" })],
      [dmFile({ status: "pending" })],
      rooms
    );
    const { pending, approved } = splitByStatus(files);
    expect(pending.map((f) => f.name)).toEqual(["b.txt"]);
    expect(approved.map((f) => f.name)).toEqual(["a.txt"]);
  });
});

describe("fileTimestamp", () => {
  it("understands both second and millisecond timestamps", () => {
    expect(fileTimestamp(0)).toBe("");
    expect(fileTimestamp(1700000000)).toBe(fileTimestamp(1700000000000));
  });
});
