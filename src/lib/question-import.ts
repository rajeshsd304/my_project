// Question import rules, shared by the browser (live preview + inline fixes) and the
// server (authoritative re-validation on commit). No Node/DB imports here.
import {
  MAX_OPTIONS,
  OPTION_LETTERS,
  clean,
  contentHash,
  detectLanguage,
  parseAnswer,
  parseDifficulty,
  parseTags,
  type Language,
  type QuestionInput,
} from "./question-content";
import { mathErrors } from "./rich";

export type TemplateKind = "SIMPLE" | "BOTH";
export type RawRow = Record<string, string>;
export type ImportRow = { line: number; raw: RawRow };
export type RowStatus = "OK" | "WARNING" | "ERROR";

export type CheckedRow = ImportRow & {
  status: RowStatus;
  errors: string[];
  warnings: string[];
  question: QuestionInput | null;
  image: string | null;
};

export type ImportContext = {
  template: TemplateKind;
  /** Display language for the SIMPLE template. */
  language: "BN" | "EN";
  allowMultiple: boolean;
  /** Lower-cased basenames found in the uploaded ZIP, or null when no ZIP was uploaded. */
  zipImages: string[] | null;
  /** contentHash values that already exist in the question bank. */
  bankHashes: string[];
};

export const MAX_IMPORT_ROWS = 2000;
const LETTERS = OPTION_LETTERS.slice(0, MAX_OPTIONS).map((l) => l.toLowerCase());

export const TEMPLATE_COLUMNS: Record<TemplateKind, string[]> = {
  SIMPLE: ["question", "option_a", "option_b", "option_c", "option_d", "correct_answer", "explanation", "difficulty", "tags", "image"],
  BOTH: [
    "question_bn",
    "question_en",
    ...["a", "b", "c", "d"].flatMap((l) => [`option_${l}_bn`, `option_${l}_en`]),
    "correct_answer",
    "explanation_bn",
    "explanation_en",
    "difficulty",
    "tags",
    "image",
  ],
};

/** Example rows shipped in the templates (an import row identical to one of these is rejected). */
export const TEMPLATE_EXAMPLES: Record<TemplateKind, RawRow[]> = {
  SIMPLE: [
    {
      question: "বাংলাদেশের জাতীয় ফুল কোনটি?",
      option_a: "শাপলা",
      option_b: "গোলাপ",
      option_c: "রজনীগন্ধা",
      option_d: "জবা",
      correct_answer: "A",
      explanation: "শাপলা বাংলাদেশের জাতীয় ফুল।",
      difficulty: "Easy",
      tags: "general knowledge; bangladesh",
      image: "",
    },
    {
      question: "What is the SI unit of force?",
      option_a: "Joule",
      option_b: "Newton",
      option_c: "Watt",
      option_d: "Pascal",
      correct_answer: "B",
      explanation: "1 N = 1 kg·m/s².",
      difficulty: "Easy",
      tags: "physics, units",
      image: "",
    },
    {
      question: "If $x^2 - 5x + 6 = 0$, what are the roots?",
      option_a: "$2, 3$",
      option_b: "$-2, -3$",
      option_c: "$1, 6$",
      option_d: "$-1, -6$",
      correct_answer: "A",
      explanation: "$x^2 - 5x + 6 = (x-2)(x-3)$, so $x = 2$ or $x = 3$.",
      difficulty: "Medium",
      tags: "math, algebra",
      image: "",
    },
  ],
  BOTH: [
    {
      question_bn: "বাংলাদেশের জাতীয় ফুল কোনটি?",
      question_en: "",
      option_a_bn: "শাপলা",
      option_a_en: "",
      option_b_bn: "গোলাপ",
      option_b_en: "",
      option_c_bn: "রজনীগন্ধা",
      option_c_en: "",
      option_d_bn: "জবা",
      option_d_en: "",
      correct_answer: "ক",
      explanation_bn: "শাপলা বাংলাদেশের জাতীয় ফুল।",
      explanation_en: "",
      difficulty: "Easy",
      tags: "general knowledge",
      image: "",
    },
    {
      question_bn: "",
      question_en: "What is the SI unit of force?",
      option_a_bn: "",
      option_a_en: "Joule",
      option_b_bn: "",
      option_b_en: "Newton",
      option_c_bn: "",
      option_c_en: "Watt",
      option_d_bn: "",
      option_d_en: "Pascal",
      correct_answer: "B",
      explanation_bn: "",
      explanation_en: "1 N = 1 kg·m/s².",
      difficulty: "Easy",
      tags: "physics, units",
      image: "",
    },
    {
      question_bn: "$x^2 - 5x + 6 = 0$ সমীকরণের মূলদ্বয় কত?",
      question_en: "What are the roots of $x^2 - 5x + 6 = 0$?",
      option_a_bn: "$2, 3$",
      option_a_en: "$2, 3$",
      option_b_bn: "$-2, -3$",
      option_b_en: "$-2, -3$",
      option_c_bn: "$1, 6$",
      option_c_en: "$1, 6$",
      option_d_bn: "$-1, -6$",
      option_d_en: "$-1, -6$",
      correct_answer: "1",
      explanation_bn: "$(x-2)(x-3)=0$, তাই $x = 2$ অথবা $3$।",
      explanation_en: "$(x-2)(x-3)=0$, so $x = 2$ or $3$.",
      difficulty: "Medium",
      tags: "math; algebra",
      image: "",
    },
  ],
};

const ALIASES: Record<string, string> = {
  answer: "correct_answer",
  correct: "correct_answer",
  ans: "correct_answer",
  correct_option: "correct_answer",
  right_answer: "correct_answer",
  solution: "explanation",
  explanations: "explanation",
  tag: "tags",
  level: "difficulty",
  picture: "image",
  image_file: "image",
  image_name: "image",
  photo: "image",
};

/** "Option A (Bangla)", "OPTION-A_BN", " option a bn " → "option_a_bn". */
export function canonicalColumn(header: string): string {
  let h = header
    .normalize("NFC")
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[()[\]]/g, " ")
    .replace(/[\s\-.]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  h = h.replace(/_bangla$|_bengali$/, "_bn").replace(/_english$/, "_en");
  h = h.replace(/^opt_?([a-f])/, "option_$1").replace(/^option([a-f])(?=_|$)/, "option_$1");
  h = h.replace(/^option_([1-6])(?=_|$)/, (_, n) => `option_${LETTERS[Number(n) - 1]}`);
  return ALIASES[h] ?? h;
}

export function detectTemplate(columns: string[]): TemplateKind {
  return columns.some((c) => /_(bn|en)$/.test(c)) ? "BOTH" : "SIMPLE";
}

/** Returns a message when decoded CSV text looks like Bangla saved in the wrong encoding. */
export function brokenBanglaMessage(text: string): string | null {
  // UTF-8 Bangla bytes (E0 A6 xx / E0 A7 xx) read as Windows-1252 show up as "à¦" / "à§".
  if (/à¦|à§/.test(text) || text.includes("�")) {
    return "Bangla text in this file looks broken (wrong encoding). In Excel, choose File → Save As → \"CSV UTF-8 (Comma delimited)\", or upload the .xlsx file instead.";
  }
  return null;
}

const v = (raw: RawRow, key: string) => clean(raw[key]);

function readRow(raw: RawRow, ctx: ImportContext) {
  const bnKey = (base: string) => (ctx.template === "BOTH" ? `${base}_bn` : ctx.language === "BN" ? base : "\u0000");
  const enKey = (base: string) => (ctx.template === "BOTH" ? `${base}_en` : ctx.language === "EN" ? base : "\u0000");
  const bi = (base: string) => ({ bn: v(raw, bnKey(base)), en: v(raw, enKey(base)) });
  const options = LETTERS.map((l) => bi(`option_${l}`));
  // Trailing empty options are fine; we keep up to the last filled one.
  let last = -1;
  options.forEach((o, i) => {
    if (o.bn || o.en) last = i;
  });
  return { text: bi("question"), explanation: bi("explanation"), options: options.slice(0, last + 1) };
}

export function isRowBlank(raw: RawRow) {
  return Object.values(raw).every((x) => !clean(x));
}

function checkRow(row: ImportRow, ctx: ImportContext): Omit<CheckedRow, "status"> & { hash: string | null } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw = row.raw;
  const { text, explanation, options } = readRow(raw, ctx);

  const examples = TEMPLATE_EXAMPLES[ctx.template].map((e) => (ctx.template === "BOTH" ? `${e.question_bn}|${e.question_en}` : e.question));
  const key = ctx.template === "BOTH" ? `${raw.question_bn ?? ""}|${raw.question_en ?? ""}` : (raw.question ?? "");
  if (examples.includes(key.trim())) {
    errors.push("This is an example row from the template. Delete it or replace it with your own question.");
  }

  let language: Language | null;
  if (ctx.template === "BOTH") {
    language = detectLanguage(!!text.bn, !!text.en);
    if (!language) errors.push("question is missing (fill question_bn, question_en or both).");
  } else {
    language = ctx.language;
    if (!text.bn && !text.en) errors.push("question is missing.");
  }

  const filled = options.filter((o) => o.bn || o.en);
  if (filled.length < 2) errors.push(`At least 2 options are required (found ${filled.length}).`);
  options.forEach((o, i) => {
    if (!o.bn && !o.en && i < options.length) errors.push(`option_${LETTERS[i]} is empty but a later option is filled.`);
  });

  if (language === "BOTH") {
    options.forEach((o, i) => {
      if ((o.bn || o.en) && (!o.bn || !o.en)) {
        warnings.push(`option_${LETTERS[i]} has only ${o.bn ? "Bangla" : "English"} text; the other language will be blank.`);
      }
    });
    if (!!explanation.bn !== !!explanation.en) warnings.push("Explanation is only in one language.");
  } else if (ctx.template === "BOTH" && language) {
    // Single-language row in the both-language template: options must be in that language.
    const want = language === "BN" ? "bn" : "en";
    options.forEach((o, i) => {
      if (!o[want] && (o.bn || o.en)) {
        errors.push(`option_${LETTERS[i]} must be in ${language === "BN" ? "Bangla" : "English"} like the question (fill option_${LETTERS[i]}_${want}).`);
      }
    });
  }

  const rawAnswer = clean(raw.correct_answer);
  const { indexes, invalid } = parseAnswer(rawAnswer);
  if (!rawAnswer) errors.push("correct_answer is missing.");
  else if (invalid.length) errors.push(`correct_answer "${rawAnswer}" is not valid. Use A, B, C or D (or 1–4, ক–ঘ).`);
  else {
    for (const idx of indexes) {
      if (!options[idx] || (!options[idx].bn && !options[idx].en)) {
        errors.push(`correct_answer is ${OPTION_LETTERS[idx]}, but option_${LETTERS[idx]} is empty.`);
      }
    }
    if (indexes.length > 1 && !ctx.allowMultiple) {
      errors.push(`correct_answer has ${indexes.length} answers (${rawAnswer}). Turn on "Allow multiple correct answers" or keep one.`);
    }
  }

  const rawDifficulty = clean(raw.difficulty);
  const difficulty = parseDifficulty(rawDifficulty);
  if (rawDifficulty && !difficulty) warnings.push(`difficulty "${rawDifficulty}" not recognised; using Medium.`);

  const image = clean(raw.image);
  const imageKey = image ? image.split(/[\\/]/).pop()!.toLowerCase() : null;
  if (imageKey) {
    if (!ctx.zipImages) warnings.push(`Image "${image}" will be skipped: no images ZIP was uploaded.`);
    else if (!ctx.zipImages.includes(imageKey)) warnings.push(`Image "${image}" was not found in the ZIP; the question will be imported without it.`);
  }

  for (const [label, t] of [["question", text], ["explanation", explanation]] as const) {
    for (const msg of [...mathErrors(t.bn), ...mathErrors(t.en)]) warnings.push(`Formula problem in ${label}: ${msg}`);
  }

  const question: QuestionInput | null =
    errors.length || !language
      ? null
      : {
          language,
          text: { bn: language === "EN" ? null : text.bn, en: language === "BN" ? null : text.en },
          options: options.map((o, i) => ({
            bn: language === "EN" ? null : o.bn,
            en: language === "BN" ? null : o.en,
            isCorrect: indexes.includes(i),
          })),
          explanation: { bn: language === "EN" ? null : explanation.bn, en: language === "BN" ? null : explanation.en },
          difficulty: difficulty ?? "MEDIUM",
          tags: parseTags(raw.tags),
        };

  return {
    ...row,
    errors,
    warnings,
    question,
    image: imageKey && ctx.zipImages?.includes(imageKey) ? imageKey : null,
    hash: question ? contentHash(question.text) : null,
  };
}

/** Validate every row, including duplicates inside the file and against the bank. */
export function checkRows(rows: ImportRow[], ctx: ImportContext): CheckedRow[] {
  const bank = new Set(ctx.bankHashes);
  const firstLine = new Map<string, number>();
  return rows.map((row) => {
    const { hash, ...checked } = checkRow(row, ctx);
    if (hash) {
      if (bank.has(hash)) checked.warnings.push("A question with the same text already exists in the bank (duplicate).");
      const seen = firstLine.get(hash);
      if (seen !== undefined) checked.warnings.push(`Same question as row ${seen} in this file (duplicate).`);
      else firstLine.set(hash, row.line);
    }
    const status: RowStatus = checked.errors.length ? "ERROR" : checked.warnings.length ? "WARNING" : "OK";
    return { ...checked, status };
  });
}

/** Hashes to look up in the bank for duplicate warnings. */
export function rowHashes(rows: ImportRow[], ctx: Omit<ImportContext, "bankHashes">): string[] {
  return checkRows(rows, { ...ctx, bankHashes: [] }).flatMap((r) => (r.question ? [contentHash(r.question.text)] : []));
}

/** Imports can be undone for this long. */
export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;
