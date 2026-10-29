import { renderRich } from "@/lib/rich";

/** Renders text with KaTeX formulas. Pass `html` when it was already rendered on the server. */
export function RichText({ text, html, className = "" }: { text?: string | null; html?: string | null; className?: string }) {
  const content = html ?? renderRich(text);
  if (!content) return null;
  return <div className={`rich break-words ${className}`} dangerouslySetInnerHTML={{ __html: content }} />;
}
