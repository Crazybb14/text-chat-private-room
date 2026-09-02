import db from "@/lib/shared/kliv-database.js";

export interface PollRow {
  _row_id: number;
  question: string;
  /** JSON-encoded string array of answer options. */
  options: string;
  is_active: number;
  created_by: string | null;
  closed_at: number | null;
  [key: string]: unknown;
}

export interface PollVoteRow {
  _row_id: number;
  poll_id: number;
  username: string;
  option_index: number;
  _created_at: number;
  [key: string]: unknown;
}

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 6;
export const MAX_POLL_QUESTION_LENGTH = 200;

/** Reads the JSON option list off a poll row, always returning a string[]. */
export function parseOptions(json: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(json ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((option) => String(option));
  } catch {
    return [];
  }
}

/** Returns an error message when a poll isn't ready to post, otherwise null. */
export function validatePoll(question: string, options: string[]): string | null {
  if (!question.trim()) return "Add a question first.";
  if (question.trim().length > MAX_POLL_QUESTION_LENGTH)
    return `Keep the question under ${MAX_POLL_QUESTION_LENGTH} characters.`;
  const clean = options.map((o) => o.trim()).filter(Boolean);
  if (clean.length < MIN_POLL_OPTIONS) return "A poll needs at least 2 options.";
  if (clean.length > MAX_POLL_OPTIONS) return `A poll can have at most ${MAX_POLL_OPTIONS} options.`;
  return null;
}

/** Vote count per option. Out-of-range votes are ignored. */
export function tallyVotes(
  options: string[],
  votes: Pick<PollVoteRow, "option_index">[],
): number[] {
  const counts = new Array(options.length).fill(0);
  for (const vote of votes) {
    const index = Number(vote.option_index);
    if (Number.isInteger(index) && index >= 0 && index < counts.length) counts[index] += 1;
  }
  return counts;
}

/** Whole-number percentages per option (0 when nobody has voted). */
export function votePercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total === 0) return counts.map(() => 0);
  return counts.map((c) => Math.round((c / total) * 100));
}

export function hasVoted(votes: Pick<PollVoteRow, "username">[], username: string): boolean {
  return votes.some((vote) => vote.username === username);
}

export type VoteResult = { ok: true } | { ok: false; reason: string };

/** Casts one vote. A person can only vote once per poll (also enforced in the database). */
export async function castVote(
  pollId: number,
  username: string,
  optionIndex: number,
  optionCount: number,
): Promise<VoteResult> {
  if (!username) return { ok: false, reason: "Sign in before voting." };
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= optionCount)
    return { ok: false, reason: "Pick one of the options." };
  try {
    const mine = await db.query<PollVoteRow>("poll_votes", {
      poll_id: `eq.${pollId}`,
      username: `eq.${username}`,
    });
    if (mine.length > 0) return { ok: false, reason: "You already voted in this poll." };
    await db.insert<PollVoteRow>("poll_votes", {
      poll_id: pollId,
      username,
      option_index: optionIndex,
    });
    return { ok: true };
  } catch {
    // The database refuses a second vote from the same person.
    return { ok: false, reason: "You already voted in this poll." };
  }
}

export async function createPoll(
  question: string,
  options: string[],
  createdBy: string,
): Promise<PollRow> {
  return db.insert<PollRow>("polls", {
    question: question.trim(),
    options: JSON.stringify(options.map((o) => o.trim()).filter(Boolean)),
    is_active: 1,
    created_by: createdBy,
    closed_at: null,
  });
}

export async function getActivePolls(): Promise<PollRow[]> {
  return db.query<PollRow>("polls", { is_active: "eq.1", order: "_row_id.desc" });
}

export async function getAllPolls(): Promise<PollRow[]> {
  return db.query<PollRow>("polls", { order: "_row_id.desc" });
}

export async function getVotesFor(pollId: number): Promise<PollVoteRow[]> {
  return db.query<PollVoteRow>("poll_votes", { poll_id: `eq.${pollId}` });
}

export async function getAllVotes(): Promise<PollVoteRow[]> {
  return db.query<PollVoteRow>("poll_votes", { order: "_row_id.desc" });
}

export async function closePoll(pollId: number): Promise<void> {
  await db.updateOne("polls", { _row_id: `eq.${pollId}` }, { is_active: 0, closed_at: Math.floor(Date.now() / 1000) });
}

export async function reopenPoll(pollId: number): Promise<void> {
  await db.updateOne("polls", { _row_id: `eq.${pollId}` }, { is_active: 1, closed_at: null });
}

export async function deletePoll(pollId: number): Promise<void> {
  await db.delete("poll_votes", { poll_id: `eq.${pollId}` });
  await db.deleteOne("polls", { _row_id: `eq.${pollId}` });
}
