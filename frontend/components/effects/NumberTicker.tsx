"use client";
import { animate } from "framer-motion";
import { useEffect, useRef } from "react";

interface Props { value: number; decimals?: number; suffix?: string; className?: string }

export default function NumberTicker({ value, decimals = 0, suffix = "", className = "" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => { if (ref.current) ref.current.textContent = v.toFixed(decimals) + suffix; },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, decimals, suffix]);
  return <span ref={ref} className={`num ${className}`}>{value.toFixed(decimals)}{suffix}</span>;
}
