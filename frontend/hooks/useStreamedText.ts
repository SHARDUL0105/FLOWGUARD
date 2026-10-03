"use client";
import { useEffect, useState } from "react";

/** Reveals `text` at ~cps characters per second. Restarts when the text changes. */
export function useStreamedText(text: string, cps = 40) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 1000 / cps);
    return () => clearInterval(id);
  }, [text, cps]);
  return { shown: text.slice(0, n), done: n >= text.length };
}
