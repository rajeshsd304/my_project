// Shared (browser + server) rules for question content: languages, difficulty, tags,
// answer letters, duplicate hashing and search text.

export const LANGUAGES = ["BN", "EN", "BOTH"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_LABEL: Record<Language, string> = { BN: "Bangla", EN: "English", BOTH: "Both" };

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

export const MAX_OPTIONS = 6;
export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
const BANGLA_LETTERS = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];

export type BiText = { bn: string | null; en: string | null };

export type QuestionInput = {
  language: Language;
  text: BiText;
  options: (BiText & { isCorrect: boolean })[];
  explanation: BiText;
  difficulty: Difficulty;
  tags: string[];
};

export const clean = (s: string | null | undefined) => {
  const v = (s ?? "").normalize("NFC").replace(/\r\n?/g, "\n").trim();
  return v === "" ? null : v;
};

export function isLanguage(v: unknown): v is Language {
  return typeof v === "string" && (LANGUAGES as readonly string[]).includes(v);
}

/** Language a row should be shown in, based on which fields are filled. */
export function detectLanguage(hasBn: boolean, hasEn: boolean): Language | null {
  if (hasBn && hasEn) return "BOTH";
  if (hasBn) return "BN";
  if (hasEn) return "EN";
  return null;
}

/** Keep only the fields that the chosen language displays. */
export function pick(t: BiText, language: Language): BiText {
  return { bn: language === "EN" ? null : clean(t.bn), en: language === "BN" ? null : clean(t.en) };
}

export function parseDifficulty(raw: string | null | undefined): Difficulty | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (["easy", "e", "1", "সহজ"].includes(v)) return "EASY";
  if (["medium", "m", "2", "normal", "মধ্যম"].includes(v)) return "MEDIUM";
  if (["hard", "h", "3", "difficult", "কঠিন"].includes(v)) return "HARD";
  return null;
}

/** Comma- or semicolon-separated tags → unique, trimmed, lower-cased list. */
export function parseTags(raw: string | string[] | null | undefined): string[] {
  const list = Array.isArray(raw) ? raw : (raw ?? "").split(/[,;]/);
  const out: string[] = [];
  for (const t of list) {
    const tag = t.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase().slice(0, 40);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 15);
}

export const encodeTags = (tags: string[]) => (tags.length ? `,${tags.join(",")},` : "");
export const decodeTags = (s: string) => s.split(",").filter(Boolean);

/**
 * Parse correct_answer: A/a/1/ক → option 0, B/2/খ → 1, … Several answers may be
 * separated by commas, semicolons, slashes or spaces ("A,C").
 */
export function parseAnswer(raw: string | null | undefined): { indexes: number[]; invalid: string[] } {
  const parts = (raw ?? "").normalize("NFC").split(/[,;/\s]+/).map((p) => p.trim()).filter(Boolean);
  const indexes: number[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    let idx = OPTION_LETTERS.indexOf(p.toUpperCase());
    if (idx < 0) idx = BANGLA_LETTERS.indexOf(p);
    if (idx < 0 && /^\d+$/.test(p)) idx = Number(p) - 1;
    if (idx < 0 || idx >= MAX_OPTIONS) invalid.push(p);
    else if (!indexes.includes(idx)) indexes.push(idx);
  }
  return { indexes: indexes.sort(), invalid };
}

function normaliseForCompare(s: string | null) {
  return (s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Small, fast, deterministic string hash (cyrb53) — identical in browser and server. */
export function hashString(str: string) {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Duplicate key: question text in either language (so the same question in BN and BOTH still matches). */
export function contentHashes(text: BiText): string[] {
  return [text.bn, text.en].filter((t): t is string => !!clean(t)).map((t) => hashString(normaliseForCompare(t)));
}

export function contentHash(text: BiText) {
  return hashString(`${normaliseForCompare(text.bn)}|${normaliseForCompare(text.en)}`);
}

export function buildSearchText(q: Pick<QuestionInput, "text" | "options" | "explanation" | "tags">) {
  return [q.text.bn, q.text.en, ...q.options.flatMap((o) => [o.bn, o.en]), q.explanation.bn, q.explanation.en, q.tags.join(" ")]
    .filter(Boolean)
    .join("\n")
    .normalize("NFC")
    .toLowerCase();
}

/** Validation shared by the editor and the API. Returns plain-English errors. */
export function validateQuestion(q: QuestionInput, opts: { allowMultiple?: boolean } = {}): string[] {
  const errors: string[] = [];
  const needBn = q.language !== "EN";
  const needEn = q.language !== "BN";
  if (needBn && !clean(q.text.bn)) errors.push("Bangla question text is missing.");
  if (needEn && !clean(q.text.en)) errors.push("English question text is missing.");
  const filled = q.options.filter((o) => (needBn && clean(o.bn)) || (needEn && clean(o.en)));
  if (filled.length < 2) errors.push("At least 2 options are required.");
  if (filled.length !== q.options.length) errors.push("Remove empty options.");
  if (q.options.length > MAX_OPTIONS) errors.push(`At most ${MAX_OPTIONS} options are allowed.`);
  if (q.language === "BOTH") {
    q.options.forEach((o, i) => {
      if (!clean(o.bn) || !clean(o.en)) errors.push(`Option ${OPTION_LETTERS[i]} needs both Bangla and English text.`);
    });
  }
  const correct = q.options.filter((o) => o.isCorrect).length;
  if (correct === 0) errors.push("Mark the correct answer.");
  if (correct > 1 && opts.allowMultiple === false) errors.push("Only one correct answer is allowed.");
  return errors;
}
