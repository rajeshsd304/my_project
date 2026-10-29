// Turns stored question text into pre-rendered HTML for QuestionView (server or browser).
import type { BiHtml, QuestionViewData } from "@/components/question-view";
import { renderRich } from "./rich";

type TextPair = { bn?: string | null; en?: string | null };

export function renderBi(t: TextPair): BiHtml {
  return { bn: t.bn ? renderRich(t.bn) : null, en: t.en ? renderRich(t.en) : null };
}

export function renderQuestion(q: {
  textBn: string | null;
  textEn: string | null;
  imageId?: string | null;
  explanationBn?: string | null;
  explanationEn?: string | null;
  options: { id: string; textBn: string | null; textEn: string | null }[];
}, opts: { explanation?: boolean } = {}): QuestionViewData {
  return {
    text: renderBi({ bn: q.textBn, en: q.textEn }),
    imageUrl: q.imageId ? `/api/files/${q.imageId}` : null,
    options: q.options.map((o) => ({ id: o.id, html: renderBi({ bn: o.textBn, en: o.textEn }) })),
    explanation: opts.explanation ? renderBi({ bn: q.explanationBn, en: q.explanationEn }) : null,
  };
}
