// Lightweight Avro-style phonetic Bangla typing ("amar sonar bangla" → "আমার সোনার বাংলা").
// Covers the common Avro rules: consonants, vowels/kar forms, automatic conjuncts (hasanta),
// jo-fola (y), bo-fola (w), anusvara (ng), chandrabindu (^) and visarga (:).

const VOWELS: Record<string, [string, string]> = {
  // roman: [independent, kar]
  rri: ["ঋ", "ৃ"],
  OI: ["ঐ", "ৈ"],
  OU: ["ঔ", "ৌ"],
  oi: ["ঐ", "ৈ"],
  ou: ["ঔ", "ৌ"],
  a: ["আ", "া"],
  i: ["ই", "ি"],
  I: ["ঈ", "ী"],
  u: ["উ", "ু"],
  U: ["ঊ", "ূ"],
  e: ["এ", "ে"],
  O: ["ও", "ো"],
  o: ["অ", ""],
};

const CONSONANTS: Record<string, string> = {
  kkh: "ক্ষ", kSh: "ক্ষ", gg: "জ্ঞ",
  kh: "খ", gh: "ঘ", Ng: "ঙ", ch: "ছ", jh: "ঝ", NG: "ঞ", Th: "ঠ", Dh: "ঢ", th: "থ", dh: "ধ",
  ph: "ফ", bh: "ভ", sh: "শ", Sh: "ষ", Rh: "ঢ়",
  k: "ক", g: "গ", c: "চ", j: "জ", J: "জ", T: "ট", D: "ড", N: "ণ", t: "ত", d: "দ", n: "ন",
  p: "প", f: "ফ", b: "ব", v: "ভ", m: "ম", z: "য", r: "র", l: "ল", S: "ষ", s: "স", h: "হ",
  R: "ড়", Y: "য়", q: "ক", x: "ক্স",
};

const SIGNS: Record<string, string> = { ng: "ং", "^": "ঁ", ":": "ঃ", "t``": "ৎ" };

const PATTERNS = [...Object.keys(VOWELS), ...Object.keys(CONSONANTS), ...Object.keys(SIGNS), "y", "w"].sort((a, b) => b.length - a.length);

const HASANTA = "্";

export function toBangla(roman: string): string {
  let out = "";
  let i = 0;
  let afterConsonant = false;
  while (i < roman.length) {
    let match = PATTERNS.find((p) => roman.startsWith(p, i));
    if (!match) {
      // Letters that only exist in lower case are case-insensitive (K = k).
      const lower = roman[i].toLowerCase();
      match = PATTERNS.find((p) => p === lower || (p.length > 1 && roman.slice(i, i + p.length).toLowerCase() === p && p === p.toLowerCase()));
      if (match) {
        i += match.length;
        match = PATTERNS.find((p) => p === match) ?? match;
      } else {
        out += roman[i++];
        afterConsonant = false;
        continue;
      }
    } else {
      i += match.length;
    }

    if (match in VOWELS) {
      const [full, kar] = VOWELS[match];
      out += afterConsonant ? kar : full;
      afterConsonant = false;
    } else if (match === "y") {
      out += afterConsonant ? HASANTA + "য" : "য়";
      // jo-fola keeps the cluster open for a following vowel sign.
    } else if (match === "w") {
      out += afterConsonant ? HASANTA + "ব" : "ও";
      // bo-fola, like jo-fola, keeps the cluster open; a lone w is the vowel ও.
    } else if (match in SIGNS) {
      out += SIGNS[match];
      afterConsonant = false;
    } else {
      out += (afterConsonant ? HASANTA : "") + CONSONANTS[match];
      afterConsonant = true;
    }
  }
  return out;
}

/**
 * If the text before `caret` ends with a roman word (outside $…$ math), return the
 * converted text and new caret position; otherwise null.
 */
export function convertWordBefore(
  value: string,
  caret: number,
): { value: string; caret: number; start: number; text: string } | null {
  const before = value.slice(0, caret);
  const dollars = (before.match(/(?<!\\)\$/g) ?? []).length;
  if (dollars % 2 === 1) return null; // inside a formula
  const m = before.match(/[A-Za-z^:`]+$/);
  if (!m) return null;
  const bn = toBangla(m[0]);
  if (bn === m[0]) return null;
  const start = caret - m[0].length;
  return { value: value.slice(0, start) + bn + value.slice(caret), caret: start + bn.length, start, text: bn };
}
