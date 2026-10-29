"use client";

import { useRef, type KeyboardEvent, type TextareaHTMLAttributes } from "react";
import { convertWordBefore } from "@/lib/avro";

const TRIGGERS: Record<string, string> = { " ": " ", Enter: "\n", ",": ",", "?": "?", "!": "!", ";": ";", ".": "।" };

/** Textarea with optional Avro-style phonetic typing: each roman word converts when you press space/enter/punctuation. */
export function PhoneticTextarea({
  value,
  onValue,
  phonetic,
  ...props
}: { value: string; onValue: (v: string) => void; phonetic: boolean } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  /** Replace [start, end) with text through the browser's editing pipeline, so caret, undo and React state stay in sync. */
  function replaceRange(el: HTMLTextAreaElement, start: number, end: number, text: string) {
    el.setSelectionRange(start, end);
    // execCommand keeps native undo and fires a real input event; setRangeText is the fallback.
    if (!document.execCommand("insertText", false, text)) {
      el.setRangeText(text, start, end, "end");
      onValue(el.value);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!phonetic || !(e.key in TRIGGERS) || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    const caret = el.selectionStart;
    const converted = convertWordBefore(el.value, caret);
    if (!converted) return;
    e.preventDefault();
    // "." becomes the Bangla dari (।) only right after a converted word.
    replaceRange(el, converted.start, caret, converted.text + TRIGGERS[e.key]);
  }

  function onBlur() {
    const el = ref.current;
    if (!phonetic || !el || el.selectionStart !== el.value.length) return;
    const converted = convertWordBefore(el.value, el.value.length);
    if (converted) onValue(converted.value);
  }

  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      onChange={(e) => onValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      className={`input min-h-0 leading-relaxed ${props.className ?? ""}`}
    />
  );
}
