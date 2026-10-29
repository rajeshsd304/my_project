import { OPTION_LETTERS } from "@/lib/question-content";
import { Icon } from "./icons";

/** Pre-rendered HTML for one piece of text in the language(s) the author entered. */
export type BiHtml = { bn: string | null; en: string | null };

export type QuestionViewData = {
  text: BiHtml;
  options: { id: string; html: BiHtml }[];
  imageUrl?: string | null;
  explanation?: BiHtml | null;
};

/**
 * Fixed student layout: Bangla first, English directly below (for questions, options and
 * explanations). There is no language toggle — students see exactly what was entered.
 */
export function BiBlock({ html, className = "" }: { html: BiHtml; className?: string }) {
  return (
    <div className={className}>
      {html.bn && <div className="rich break-words" lang="bn" dangerouslySetInnerHTML={{ __html: html.bn }} />}
      {html.en && (
        <div
          className={`rich break-words ${html.bn ? "mt-1.5 border-t border-dashed border-line-strong pt-1.5 text-fg/80" : ""}`}
          lang="en"
          dangerouslySetInnerHTML={{ __html: html.en }}
        />
      )}
    </div>
  );
}

type OptionState = "idle" | "selected" | "correct" | "wrong" | "missed";

const OPTION_STYLE: Record<OptionState, string> = {
  idle: "border-line-strong bg-surface-2",
  selected: "border-accent bg-accent-soft",
  correct: "border-success/60 bg-success-soft",
  wrong: "border-danger/60 bg-danger-soft",
  missed: "border-success/60 border-dashed bg-surface-2",
};

export function QuestionView({
  data,
  number,
  optionState,
  onSelect,
  multi,
  disabled,
}: {
  data: QuestionViewData;
  number?: number;
  optionState?: (optionId: string) => OptionState;
  onSelect?: (optionId: string) => void;
  multi?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex gap-3">
        {number !== undefined && <span className="shrink-0 pt-0.5 font-semibold text-accent-text">{number}.</span>}
        <div className="min-w-0 flex-1 text-[17px] leading-relaxed">
          <BiBlock html={data.text} />
          {data.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.imageUrl} alt="Question figure" loading="lazy" className="mt-3 max-h-80 max-w-full rounded-lg border border-line bg-white" />
          )}
          {multi && <p className="mt-2 text-xs font-medium text-warning">More than one answer may be correct. Select all that apply.</p>}
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        {data.options.map((o, i) => {
          const state = optionState?.(o.id) ?? "idle";
          const content = (
            <>
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full border text-sm font-semibold ${
                  state === "selected" ? "border-accent bg-accent text-white" : state === "correct" ? "border-success bg-success text-black" : state === "wrong" ? "border-danger bg-danger text-black" : "border-line-strong text-muted"
                }`}
              >
                {OPTION_LETTERS[i]}
              </span>
              <BiBlock html={o.html} className="min-w-0 flex-1 pt-0.5 text-[16px] leading-relaxed" />
              {state === "correct" && <Icon name="check" className="mt-1 size-5 shrink-0 text-success" />}
              {state === "missed" && <span className="mt-1 shrink-0 text-xs font-semibold text-success">Correct</span>}
              {state === "wrong" && <Icon name="close" className="mt-1 size-5 shrink-0 text-danger" />}
            </>
          );
          const cls = `flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${OPTION_STYLE[state]}`;
          return (
            <li key={o.id}>
              {onSelect ? (
                <button
                  type="button"
                  role={multi ? "checkbox" : "radio"}
                  aria-checked={state === "selected"}
                  disabled={disabled}
                  onClick={() => onSelect(o.id)}
                  className={`${cls} hover:border-subtle disabled:cursor-not-allowed`}
                >
                  {content}
                </button>
              ) : (
                <div className={cls}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {data.explanation && (data.explanation.bn || data.explanation.en) && (
        <div className="mt-4 rounded-xl border border-accent/25 bg-accent-soft/50 px-4 py-3 text-[15px] leading-relaxed">
          <div className="mb-1 text-xs font-semibold tracking-wide text-accent-text uppercase">Explanation</div>
          <BiBlock html={data.explanation} />
        </div>
      )}
    </div>
  );
}
