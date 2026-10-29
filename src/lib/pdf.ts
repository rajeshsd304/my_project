// PDF rendering via headless Chrome (Puppeteer). Chrome shapes Bangla with HarfBuzz, so
// conjuncts (যুক্তাক্ষর) render correctly, and KaTeX renders exactly as on the web.
// Fonts (Hind Siliguri + KaTeX) are embedded as data URIs — no network needed.
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser } from "puppeteer";

const NODE_MODULES = path.join(process.cwd(), "node_modules");

function dataUri(file: string, mime: string) {
  return `url(data:${mime};base64,${readFileSync(file).toString("base64")}) format("woff2")`;
}

let fontCss: string | null = null;
/** @font-face rules for Hind Siliguri (Bangla + Latin, 400/500/600/700) and KaTeX, fully inlined. */
export function embeddedFontCss() {
  if (fontCss) return fontCss;
  const dir = path.join(NODE_MODULES, "@fontsource/hind-siliguri");
  const hind = ["400", "500", "600", "700"]
    .map((w) =>
      readFileSync(path.join(dir, `${w}.css`), "utf8").replace(
        /url\(\.\/files\/([^)]+)\.woff2\) format\('woff2'\), url\([^)]+\) format\('woff'\)/g,
        (_, name) => dataUri(path.join(dir, "files", `${name}.woff2`), "font/woff2"),
      ),
    )
    .join("\n");
  const katexDir = path.join(NODE_MODULES, "katex/dist");
  const katex = readFileSync(path.join(katexDir, "katex.min.css"), "utf8").replace(
    /url\(fonts\/([^)]+)\.woff2\) format\("woff2"\)(?:,url\([^)]+\) format\("[^"]+"\))*/g,
    (_, name) => dataUri(path.join(katexDir, "fonts", `${name}.woff2`), "font/woff2"),
  );
  fontCss = `${hind}\n${katex}`;
  return fontCss;
}

const globalForPdf = globalThis as unknown as { pdfBrowser?: Promise<Browser> };

async function browser() {
  if (!globalForPdf.pdfBrowser) {
    globalForPdf.pdfBrowser = import("puppeteer").then(({ default: puppeteer }) =>
      puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none", "--disable-dev-shm-usage"],
      }),
    );
    globalForPdf.pdfBrowser.then((b) => b.on("disconnected", () => (globalForPdf.pdfBrowser = undefined))).catch(() => (globalForPdf.pdfBrowser = undefined));
  }
  return globalForPdf.pdfBrowser;
}

/**
 * `footer` must be plain English: Chrome draws header/footer templates outside the page,
 * without its embedded fonts, so Bangla there could not be shaped. Bangla belongs in the body.
 */
export async function htmlToPdf(html: string, opts: { footer?: string } = {}): Promise<Uint8Array> {
  const page = await (await browser()).newPage();
  try {
    // JavaScript is not needed (all content is pre-rendered) and is disabled for safety.
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:8px;color:#666;padding:0 14mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>${escapeHtml(opts.footer ?? "")}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await page.close();
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Printable document shell: always white paper, dark ink, regardless of the black website theme. */
export function pdfDocument(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
${embeddedFontCss()}
*{box-sizing:border-box}
html,body{background:#ffffff;color:#111111;margin:0}
body{font-family:"Hind Siliguri",sans-serif;font-size:11.5pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
/* Bangla inside formulas (\\text{…}) must use Hind Siliguri, never a system fallback font. */
.katex{font-family:KaTeX_Main,"Hind Siliguri",serif;font-size:1.05em;color:#111}
h1{font-size:18pt;margin:0 0 2pt;line-height:1.25}
h2{font-size:12.5pt;margin:16pt 0 6pt;border-bottom:1px solid #ddd;padding-bottom:3pt}
.muted{color:#555}.small{font-size:9.5pt}
.brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a6bff;padding-bottom:8pt;margin-bottom:12pt}
.brand .name{font-weight:700;font-size:13pt;color:#1a6bff}
.facts{display:flex;flex-wrap:wrap;gap:4pt 16pt;font-size:10pt;margin:6pt 0}
.rule{border:1px solid #e0a800;background:#fff8e1;padding:5pt 8pt;border-radius:4pt;font-size:10pt;font-weight:600;margin:6pt 0}
table{width:100%;border-collapse:collapse;font-size:10.5pt}
th,td{border:1px solid #d0d0d0;padding:5pt 7pt;text-align:left;vertical-align:top}
th{background:#f2f4f8;font-weight:600}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.q{break-inside:avoid;margin:0 0 11pt;padding-bottom:9pt;border-bottom:1px solid #eee}
.q .head{display:flex;gap:6pt}
.q .no{font-weight:700;min-width:20pt}
.en{color:#333;margin-top:2pt;padding-top:2pt;border-top:1px dashed #ccc}
.opts{display:grid;grid-template-columns:1fr 1fr;gap:3pt 14pt;margin:5pt 0 0 26pt}
.opts.wide{grid-template-columns:1fr}
.opt{display:flex;gap:5pt}.opt .l{font-weight:600;min-width:14pt}
.opt.correct{font-weight:600}
.ans{margin:5pt 0 0 26pt;font-size:10.5pt}
.exp{margin:4pt 0 0 26pt;padding:5pt 8pt;background:#f5f8ff;border-left:3px solid #1a6bff;font-size:10.5pt}
img.fig{max-width:60%;max-height:160pt;margin:4pt 0 0 26pt;display:block}
.score{font-size:30pt;font-weight:700;line-height:1}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6pt;margin-top:8pt}
.cell{border:1px solid #ddd;border-radius:4pt;padding:6pt 8pt}.cell .k{font-size:8.5pt;color:#555}.cell .v{font-weight:700;font-size:12pt}
</style></head><body>${body}</body></html>`;
}
