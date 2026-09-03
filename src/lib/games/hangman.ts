import { cloneState, otherRole, type Difficulty, type MatchState, type MoveResult, type Role } from "./types";

export const HM_WORDS: { word: string; category: string }[] = [
  { word: "TIGER", category: "Animals" },
  { word: "PENGUIN", category: "Animals" },
  { word: "DOLPHIN", category: "Animals" },
  { word: "EAGLE", category: "Animals" },
  { word: "GIRAFFE", category: "Animals" },
  { word: "OCTOPUS", category: "Animals" },
  { word: "KANGAROO", category: "Animals" },
  { word: "PANTHER", category: "Animals" },
  { word: "FALCON", category: "Animals" },
  { word: "MONKEY", category: "Animals" },
  { word: "BEAVER", category: "Animals" },
  { word: "TOUCAN", category: "Animals" },
  { word: "WAFFLE", category: "Food" },
  { word: "BURRITO", category: "Food" },
  { word: "SPAGHETTI", category: "Food" },
  { word: "CROISSANT", category: "Food" },
  { word: "PANCAKE", category: "Food" },
  { word: "DUMPLING", category: "Food" },
  { word: "SUSHI", category: "Food" },
  { word: "LASAGNA", category: "Food" },
  { word: "MUFFIN", category: "Food" },
  { word: "PRETZEL", category: "Food" },
  { word: "OMELETTE", category: "Food" },
  { word: "CUPCAKE", category: "Food" },
  { word: "MUSEUM", category: "Places" },
  { word: "LIBRARY", category: "Places" },
  { word: "VOLCANO", category: "Places" },
  { word: "LIGHTHOUSE", category: "Places" },
  { word: "PYRAMID", category: "Places" },
  { word: "CASTLE", category: "Places" },
  { word: "STADIUM", category: "Places" },
  { word: "WATERFALL", category: "Places" },
  { word: "AIRPORT", category: "Places" },
  { word: "CATHEDRAL", category: "Places" },
  { word: "HARBOR", category: "Places" },
  { word: "CARNIVAL", category: "Places" },
  { word: "SOCCER", category: "Sports" },
  { word: "BASKETBALL", category: "Sports" },
  { word: "ARCHERY", category: "Sports" },
  { word: "GYMNASTICS", category: "Sports" },
  { word: "MARATHON", category: "Sports" },
  { word: "VOLLEYBALL", category: "Sports" },
  { word: "SNOWBOARD", category: "Sports" },
  { word: "WRESTLING", category: "Sports" },
  { word: "BADMINTON", category: "Sports" },
  { word: "SKATEBOARD", category: "Sports" },
  { word: "TRIATHLON", category: "Sports" },
  { word: "CRICKET", category: "Sports" },
  { word: "GALAXY", category: "Space" },
  { word: "ASTEROID", category: "Space" },
  { word: "TELESCOPE", category: "Space" },
  { word: "SATELLITE", category: "Space" },
  { word: "NEBULA", category: "Space" },
  { word: "COMET", category: "Space" },
  { word: "ECLIPSE", category: "Space" },
  { word: "METEOR", category: "Space" },
  { word: "ORBIT", category: "Space" },
  { word: "SUPERNOVA", category: "Space" },
  { word: "PLANETARIUM", category: "Space" },
  { word: "GUITAR", category: "Music" },
  { word: "TROMBONE", category: "Music" },
  { word: "ORCHESTRA", category: "Music" },
  { word: "SAXOPHONE", category: "Music" },
  { word: "MELODY", category: "Music" },
  { word: "HARMONICA", category: "Music" },
  { word: "SYMPHONY", category: "Music" },
  { word: "BANJO", category: "Music" },
  { word: "XYLOPHONE", category: "Music" },
  { word: "ACCORDION", category: "Music" },
  { word: "KEYBOARD", category: "Music" },
  { word: "CALCULATOR", category: "School" },
  { word: "HOMEWORK", category: "School" },
  { word: "GRADUATION", category: "School" },
  { word: "BACKPACK", category: "School" },
  { word: "LABORATORY", category: "School" },
  { word: "NOTEBOOK", category: "School" },
  { word: "SCIENCE", category: "School" },
  { word: "LIBRARIAN", category: "School" },
  { word: "CAFETERIA", category: "School" },
  { word: "DESIGN", category: "School" },
  { word: "PROJECT", category: "School" },
  { word: "EXPERIMENT", category: "School" },
];

export const HM_MISS_LIMIT: Record<Difficulty, number> = {
  easy: 10,
  medium: 8,
  hard: 6,
  impossible: 5,
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Light obfuscation so the word isn't sitting in plain text in the page data. */
export function hmEncode(word: string): string {
  return word
    .split("")
    .map((ch) => (ch.charCodeAt(0) + 7).toString(36))
    .join(".");
}

export function hmDecode(enc: string): string {
  return enc
    .split(".")
    .filter(Boolean)
    .map((part) => String.fromCharCode(parseInt(part, 36) - 7))
    .join("");
}

export interface HmState {
  word: string; // encoded
  category: string;
  revealed: string[];
  used: string[];
  wrongP1: string[];
  wrongP2: string[];
}

export function createHm(difficulty: Difficulty): MatchState<HmState> {
  void difficulty;
  const pick = HM_WORDS[Math.floor(Math.random() * HM_WORDS.length)];
  return {
    phase: "playing",
    turn: "p1",
    winner: null,
    game: {
      word: hmEncode(pick.word),
      category: pick.category,
      revealed: [],
      used: [],
      wrongP1: [],
      wrongP2: [],
    },
    log: [{ by: "system", text: `Guess letters to reveal the word — category: ${pick.category}. A hit keeps your turn.` }],
  };
}

export function hmWordLengths(state: HmState): number {
  return state.word.split(".").filter(Boolean).length;
}

function isHmMove(move: unknown): move is { letter: string } {
  return typeof move === "object" && move !== null && typeof (move as Record<string, unknown>).letter === "string";
}

export function applyHm(ms: MatchState<HmState>, role: Role, move: unknown, difficulty: Difficulty = "medium"): MoveResult {
  if (!isHmMove(move)) return { ok: false, error: "Pick a letter." };
  if (ms.phase !== "playing") return { ok: false, error: "This game is over." };
  if (ms.turn !== role) return { ok: false, error: "It's not your turn." };
  const letter = (move.letter as string).toUpperCase();
  if (!LETTERS.includes(letter)) return { ok: false, error: "Pick a letter A to Z." };
  if (ms.game.used.includes(letter)) return { ok: false, error: `${letter} was already tried.` };

  const word = hmDecode(ms.game.word);
  const next = cloneState(ms);
  next.game.used.push(letter);
  if (word.includes(letter)) {
    next.game.revealed.push(letter);
    const remaining = LETTERS.filter((l) => word.includes(l) && !next.game.revealed.includes(l));
    next.log.push({ by: role, text: `${role === "p1" ? "Player 1" : "Player 2"} found ${letter}.` });
    if (remaining.length === 0) {
      next.winner = role;
      next.phase = "done";
      next.turn = null;
      next.log.push({ by: "system", text: `The word was ${word}!` });
    }
    // correct letter keeps the turn
  } else {
    const wrongList = role === "p1" ? next.game.wrongP1 : next.game.wrongP2;
    wrongList.push(letter);
    next.log.push({ by: role, text: `${role === "p1" ? "Player 1" : "Player 2"} missed on ${letter}.` });
    const limit = HM_MISS_LIMIT[difficulty];
    if (wrongList.length >= limit) {
      next.winner = otherRole(role);
      next.phase = "done";
      next.turn = null;
      next.log.push({ by: "system", text: `${role === "p1" ? "Player 1" : "Player 2"} ran out of misses — the word was ${word}.` });
    } else {
      next.turn = otherRole(role);
    }
  }
  return { ok: true, state: next };
}

const FREQ_ORDER = "ETAOINSHRDLCUMWFGYPBVKJXQZ".split("");

/** Letters that could still appear, given the pattern and the misses so far. */
function possibleLetters(word: string, revealed: string[], used: string[]): string[] {
  const candidates = HM_WORDS.filter((entry) => {
    if (entry.word.length !== word.length) return false;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (revealed.includes(ch) && entry.word[i] !== ch) return false;
      if (!revealed.includes(ch) && revealed.length > 0 && entry.word[i] !== word[i]) {
        // positions already revealed must match; other positions must not
        if (entry.word[i] !== ch) {
          // fall through to the used-letter check below
        }
      }
    }
    return true;
  }).filter((entry) => {
    // no word may contain a tried-and-missed letter
    for (const l of used) {
      if (!revealed.includes(l) && entry.word.includes(l)) return false;
    }
    // revealed letters must appear in the word at the right spots
    for (let i = 0; i < word.length; i++) {
      if (revealed.includes(word[i]) && entry.word[i] !== word[i]) return false;
      if (!revealed.includes(word[i]) && entry.word[i] === word[i]) return false;
    }
    return true;
  });

  const pool = new Set<string>();
  for (const entry of candidates) {
    for (const ch of entry.word) {
      if (!revealed.includes(ch) && !used.includes(ch)) pool.add(ch);
    }
  }
  return LETTERS.filter((l) => pool.has(l));
}

export function hmAiMove(ms: MatchState<HmState>, role: Role, difficulty: Difficulty): unknown | null {
  if (ms.phase !== "playing" || ms.turn !== role) return null;
  const g = ms.game;
  const unused = LETTERS.filter((l) => !g.used.includes(l));
  if (unused.length === 0) return null;

  if (difficulty === "easy") {
    return { letter: unused[Math.floor(Math.random() * unused.length)] };
  }
  if (difficulty === "medium") {
    if (Math.random() < 0.2) {
      return { letter: unused[Math.floor(Math.random() * unused.length)] };
    }
    const byFreq = FREQ_ORDER.filter((l) => unused.includes(l));
    return { letter: byFreq[0] ?? unused[0] };
  }
  const word = hmDecode(g.word);
  const smart = possibleLetters(word, g.revealed, g.used);
  if (smart.length === 0) {
    const byFreq = FREQ_ORDER.filter((l) => unused.includes(l));
    return { letter: byFreq[0] ?? unused[0] };
  }
  const byFreq = FREQ_ORDER.filter((l) => smart.includes(l));
  return { letter: byFreq[0] ?? smart[0] };
}
