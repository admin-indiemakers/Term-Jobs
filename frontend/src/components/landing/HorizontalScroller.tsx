import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { EASE } from "./animations";

export function useHorizontalPanels(total: number) {
  const [index, setIndex] = useState(0);
  const locked = useRef(false);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      setIndex((current) => (current === clamped ? current : clamped));
    },
    [total],
  );

  const step = useCallback(
    (delta: number) => {
      if (locked.current) return;
      locked.current = true;
      setIndex((current) => Math.max(0, Math.min(total - 1, current + delta)));
      window.setTimeout(() => {
        locked.current = false;
      }, 750);
    },
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "Home") {
        goTo(0);
      } else if (e.key === "End") {
        goTo(total - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, goTo, total]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const primary = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(primary) < 12) return;
      e.preventDefault();
      step(primary > 0 ? 1 : -1);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [step]);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0]!.clientX;
      startY = e.touches[0]!.clientY;
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0]!.clientX - startX;
      const dy = e.changedTouches[0]!.clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
      else if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) step(dy < 0 ? 1 : -1);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [step]);

  return { index, goTo, step };
}

export function HorizontalScroller({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="fixed inset-0 overflow-hidden">
      <motion.div
        className="flex h-dvh w-max"
        animate={{ x: `-${index * 100}vw` }}
        transition={reduced ? { duration: 0.25 } : { duration: 1.15, ease: EASE }}
      >
        {children}
      </motion.div>
    </div>
  );
}
