"use client";
// Glyph Portal: a giant word that the camera flies into on scroll. The page background turns
// from paper to forest while one letter swallows the viewport, then the children (the platform
// scene) take over. Written for this project; swap in the 21st.dev original by keeping the same props.
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface Props {
  word: string;
  /** index of the letter the camera flies into */
  target: number;
  /** content on top of the word that fades out as soon as scrolling starts */
  overlay?: React.ReactNode;
  /** the platform scene revealed after the portal; receives smoothed progress 0..1 */
  children: (progress: MotionValue<number>) => React.ReactNode;
  /** scroll length in viewport heights */
  length?: number;
}

const VB_W = 1600, VB_H = 900, FONT = 232, BASE_Y = 520, MAX_SCALE = 90;
const ZOOM_END = 0.58; // progress at which the letter fills the screen

export function GlyphPortal({ word, target, overlay, children, length = 5 }: Props) {
  const section = useRef<HTMLDivElement>(null);
  const textRef = useRef<SVGTextElement>(null);
  const group = useRef<SVGGElement>(null);
  const origin = useRef({ x: VB_W / 2, y: BASE_Y - FONT * 0.36 });
  const [reduced, setReduced] = useState(false);

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  // Progress reaches 1 slightly before the section unsticks, and the spring settles inside that gap, so nothing is
  // still moving when the page scrolls on to the next section.
  const settled = useTransform(scrollYProgress, [0, 0.96], [0, 1]);
  const p = useSpring(settled, { stiffness: 150, damping: 32, mass: 0.4, restDelta: 0.0005 }); // critically damped, no bounce
  const sticky = useRef<HTMLDivElement>(null);
  const applied = useRef(-1);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const measure = () => {
      const t = textRef.current;
      if (!t) return;
      try {
        const b = t.getExtentOfChar(target);
        origin.current = { x: b.x + b.width * 0.13, y: BASE_Y - FONT * 0.36 };
      } catch { /* keep the default origin */ }
    };
    measure();
    document.fonts?.ready.then(measure);
  }, [target]);

  const apply = (v: number) => {
    if (sticky.current) sticky.current.dataset.navTone = v > 0.38 ? "dark" : "light"; // the navbar reads this
    const g = group.current;
    if (!g) return;
    if (v > 0.64 && applied.current > 0.64) return; // the word is gone; skip the 90x vector redraw
    applied.current = v;
    const z = Math.min(1, v / ZOOM_END);
    const s = Math.pow(MAX_SCALE, z * z * (3 - 2 * z)); // eased zoom
    const { x, y } = origin.current;
    const move = Math.min(1, v / 0.4);
    const tx = (VB_W / 2 - x) * move, ty = (VB_H / 2 - y) * move;
    g.setAttribute("transform", `translate(${tx} ${ty}) translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`);
  };
  useMotionValueEvent(p, "change", apply);
  useEffect(() => apply(p.get()), []); // eslint-disable-line react-hooks/exhaustive-deps

  const deepOpacity = useTransform(p, [0.2, 0.52], [0, 1]); // paper to deep green, theme-aware
  const wordOpacity = useTransform(p, [0.5, 0.62], [1, 0]);
  const overlayOpacity = useTransform(p, [0, 0.07], [1, 0]);
  const sceneOpacity = useTransform(p, [0.5, 0.66], [0, 1]);
  const wordDisplay = useTransform(p, (v) => (v > 0.63 ? "none" : "block"));

  if (reduced) {
    return (
      <div className="relative min-h-screen bg-paper">
        <div className="absolute inset-0">{overlay}</div>
        <div className="flex min-h-screen items-center justify-center"><span className="text-[14vw] font-extrabold tracking-tighter text-deep">{word}</span></div>
        <div data-nav-tone="dark" className="bg-deep py-16 text-snow">{children(p)}</div>
      </div>
    );
  }

  return (
    <div ref={section} style={{ height: `${length * 100}vh` }} className="relative">
      <div ref={sticky} data-nav-tone="light" className="sticky top-0 h-screen w-full overflow-hidden bg-paper">
        <motion.div style={{ opacity: deepOpacity, willChange: "opacity" }} className="absolute inset-0 bg-deep" aria-hidden />
        <motion.svg style={{ opacity: wordOpacity, display: wordDisplay }} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" aria-label={word}>
          <g ref={group}>
            <text
              ref={textRef}
              x={VB_W / 2}
              y={BASE_Y}
              textAnchor="middle"
              fill="rgb(var(--deep))"
              style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", fontWeight: 800, fontSize: FONT, letterSpacing: -9 }}
            >
              {word}
            </text>
          </g>
        </motion.svg>
        <motion.div style={{ opacity: overlayOpacity }} className="pointer-events-none absolute inset-0 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          {overlay}
        </motion.div>
        <motion.div style={{ opacity: sceneOpacity, willChange: "opacity" }} className="absolute inset-0">{children(p)}</motion.div>
      </div>
    </div>
  );
}
