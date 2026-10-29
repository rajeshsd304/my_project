// Renders question text to safe HTML: plain text is escaped, line breaks kept,
// and KaTeX math is rendered from $inline$ and $$display$$ delimiters (\$ = literal dollar).
// Pure function — works on the server (exam pages ship HTML, not KaTeX JS) and in the browser.
import katex from "katex";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function math(tex: string, displayMode: boolean) {
  return katex.renderToString(tex, { displayMode, throwOnError: false, strict: "ignore", trust: false, output: "html" });
}

export function renderRich(text: string | null | undefined): string {
  if (!text) return "";
  let out = "";
  let i = 0;
  let plain = "";
  const flush = () => {
    out += escapeHtml(plain).replace(/\n/g, "<br>");
    plain = "";
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && text[i + 1] === "$") {
      plain += "$";
      i += 2;
      continue;
    }
    if (ch === "$") {
      const display = text[i + 1] === "$";
      const open = display ? 2 : 1;
      const close = text.indexOf(display ? "$$" : "$", i + open);
      if (close > i + open) {
        flush();
        out += math(text.slice(i + open, close), display);
        i = close + open;
        continue;
      }
    }
    plain += ch;
    i++;
  }
  flush();
  return out;
}

/** True if the text contains math that fails to parse (shown as a warning in editors/imports). */
export function mathErrors(text: string | null | undefined): string[] {
  if (!text) return [];
  const errors: string[] = [];
  const re = /\$\$([\s\S]+?)\$\$|(?<!\\)\$([^$]+?)\$/g;
  for (const m of text.matchAll(re)) {
    try {
      katex.renderToString(m[1] ?? m[2], { throwOnError: true, strict: "ignore" });
    } catch (err) {
      errors.push((err as Error).message.replace(/^KaTeX parse error: /, ""));
    }
  }
  return errors;
}
