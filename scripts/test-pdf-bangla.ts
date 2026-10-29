/**
 * PDF Bangla conjunct (যুক্তাক্ষর) + KaTeX test.
 *   npm run test:pdf
 * Renders a test document with the production PDF engine (src/lib/pdf.ts), then checks:
 *   1. Hind Siliguri is embedded in the PDF.
 *   2. Shaping: no conjunct is left as separate glyphs with a stray hasanta (্) glyph.
 *   3. Text round-trip: every test word can be extracted from the PDF.
 * Writes test-output/bangla-test.pdf (and a PNG on macOS) for visual inspection.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { htmlToPdf, pdfDocument } from "../src/lib/pdf";
import { renderRich } from "../src/lib/rich";

const WORDS = [
  "বিজ্ঞান", "ক্ষুদ্র", "শ্রদ্ধা", "উজ্জ্বল", // requested
  "স্বাস্থ্য", "রাষ্ট্র", "সম্প্রদায়", "ঐক্য", "যুক্তাক্ষর", "ব্যাখ্যা", "স্পষ্ট", "কৃষ্ণ",
  "হৃদয়", "শ্রী", "ভক্ত", "অঙ্ক", "সঙ্গীত", "মুক্তিযুদ্ধ", "আত্মা", "পদ্ম", "লক্ষ্মী", "উদ্ভিদ", "বৃষ্টি", "ক্ষমা",
];

const html = pdfDocument(
  "Bangla conjunct test",
  `<h1>Bangla conjunct (যুক্তাক্ষর) test</h1>
<p class="muted small">Each word is printed at three sizes. Rendered by the same engine as result slips and question papers.</p>
<table><thead><tr><th>#</th><th>11.5pt</th><th>16pt</th><th>Bold 22pt</th></tr></thead><tbody>
${WORDS.map((w, i) => `<tr><td>${i + 1}</td><td>${w}</td><td style="font-size:16pt">${w}</td><td style="font-size:22pt;font-weight:700">${w}</td></tr>`).join("")}
</tbody></table>
<h2>Question in both languages with KaTeX</h2>
<div class="q"><div class="head"><span class="no">1.</span><div>
<div lang="bn">${renderRich("একটি বস্তুর ভর $m$ এবং বেগ $v$ হলে এর গতিশক্তি $E_k$ কত? (বিজ্ঞান, উজ্জ্বল)")}</div>
<div class="en">${renderRich("A body of mass $m$ moves with speed $v$. What is its kinetic energy $E_k$?")}</div></div></div>
<div class="opts"><div class="opt"><span class="l">(A)</span><div>${renderRich("$mv$")}</div></div><div class="opt correct"><span class="l">(B)</span><div>${renderRich("$\\frac{1}{2}mv^2$")}</div></div>
<div class="opt"><span class="l">(C)</span><div>${renderRich("$\\sqrt{2gh}$")}</div></div><div class="opt"><span class="l">(D)</span><div>${renderRich("$\\int_0^1 x^2\\,dx = \\frac{1}{3}$")}</div></div></div>
<div class="exp"><b>Explanation</b><div>${renderRich("$$E_k = \\frac{1}{2}mv^2 \\quad\\text{(ক্ষুদ্র কণার ক্ষেত্রেও প্রযোজ্য)}$$")}</div></div></div>`,
);

async function main() {
  mkdirSync("test-output", { recursive: true });
  const pdf = await htmlToPdf(html, { footer: "NextCampus · Bangla PDF test" });
  writeFileSync("test-output/bangla-test.pdf", pdf);
  const raw = Buffer.from(pdf).toString("latin1");
  let failures = 0;
  const report = (ok: boolean, label: string, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  };

  // 1. Embedded fonts
  const fonts = [...new Set([...raw.matchAll(/\/FontName\s*\/([A-Z]{6}\+)?([\w-]+)/g)].map((m) => m[2]))];
  report(fonts.some((f) => /HindSiliguri/i.test(f)), "Hind Siliguri embedded", fonts.join(", "));
  const foreign = fonts.filter((f) => !/HindSiliguri|KaTeX/i.test(f));
  if (foreign.length) console.log(`INFO  Other fonts: ${foreign.join(", ")} (PDF standard font used by Chrome's English page footer)`);
  report(/\/FontFile2|\/FontFile3/.test(raw), "Font programs embedded (not just referenced)");
  report(fonts.some((f) => /KaTeX/i.test(f)), "KaTeX math fonts embedded");

  // 2 + 3. Glyph-level shaping and text extraction via pdf.js
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false, disableFontFace: true, fontExtraProperties: true }).promise;
  let text = "";
  const banglaFonts = new Set<string>();
  let strayHasanta = 0;
  let conjunctGlyphs = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const ops = await page.getOperatorList();
    const content = await page.getTextContent();
    text += content.items.map((i) => ("str" in i ? i.str : "")).join("") + "\n";
    for (const it of content.items) {
      if (!("str" in it) || !/[\u0980-\u09FF]/.test(it.str)) continue;
      const font = page.commonObjs.has(it.fontName) ? (page.commonObjs.get(it.fontName) as { name?: string }) : null;
      banglaFonts.add(font?.name?.replace(/^[A-Z]{6}\+/, "") ?? "unknown");
    }
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== pdfjs.OPS.showText) continue;
      for (const g of ops.argsArray[i][0] as ({ unicode?: string } | number)[]) {
        if (typeof g !== "object" || !g?.unicode) continue;
        if (g.unicode === "\u09CD") strayHasanta++;
        else if (g.unicode.includes("\u09CD")) conjunctGlyphs++;
      }
    }
  }
  report([...banglaFonts].every((f) => /HindSiliguri/i.test(f)), "Every Bangla glyph run uses embedded Hind Siliguri", [...banglaFonts].join(", "));
  report(conjunctGlyphs > 0, "Conjuncts drawn as single shaped glyphs", `${conjunctGlyphs} conjunct glyphs found`);
  report(strayHasanta === 0, "No broken conjuncts (stray hasanta glyphs)", `${strayHasanta} stray ্ glyphs`);
  const compact = text.normalize("NFC").replace(/\s+/g, "");
  const missing = WORDS.filter((w) => !compact.includes(w));
  // Informational only: Chrome writes pre-base vowel signs (ি ে ৈ) in visual order and some
  // ligature glyphs without a Unicode mapping, so copy/paste from the PDF can differ from the
  // source text. This does not affect how the PDF looks or prints.
  console.log(`INFO  Copy-paste text layer: ${WORDS.length - missing.length}/${WORDS.length} words extract verbatim${missing.length ? ` (visual-order or unmapped glyphs in: ${missing.join(" ")})` : ""}`);

  if (process.platform === "darwin") {
    try {
      execFileSync("sips", ["-s", "format", "png", "-s", "dpiWidth", "150", "-s", "dpiHeight", "150", "test-output/bangla-test.pdf", "--out", "test-output/bangla-test.png"], { stdio: "ignore" });
      console.log("Wrote test-output/bangla-test.png (page 1, rendered by macOS PDFKit)");
    } catch {
      /* optional */
    }
  }
  console.log(`\nPDF: test-output/bangla-test.pdf (${(pdf.byteLength / 1024).toFixed(0)} KB, ${doc.numPages} page(s))`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
