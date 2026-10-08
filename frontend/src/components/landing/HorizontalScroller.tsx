import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";


export function useHorizontalPanels(total: number, enabled: boolean = true) {
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
      setIndex((current) => {
        if (current === total - 1 && delta > 0) return 0;
        return Math.max(0, Math.min(total - 1, current + delta));
      });
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      window.setTimeout(() => {
        locked.current = false;
      }, isMobile ? 380 : 650);
    },
    [total],
  );

  useEffect(() => {
    if (!enabled) return;
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
  }, [step, goTo, total, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onWheel = (e: WheelEvent) => {
      const primary = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(primary) < 12) return;
      e.preventDefault();
      step(primary > 0 ? 1 : -1);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [step, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0]!.clientX;
      startY = e.touches[0]!.clientY;
      startTime = Date.now();
    };

    const onMove = (e: TouchEvent) => {
      if (!e.cancelable) return;
      const curX = e.touches[0]!.clientX;
      const curY = e.touches[0]!.clientY;
      const dx = Math.abs(curX - startX);
      const dy = Math.abs(curY - startY);
      if (dx > dy && dx > 8) {
        e.preventDefault();
      }
    };

    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0]!.clientX - startX;
      const dy = e.changedTouches[0]!.clientY - startY;
      const dt = Math.max(1, Date.now() - startTime);

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Fast flick or standard swipe detection
      const isQuickFlick = dt < 320 && (absX > 25 || absY > 30);
      const isNormalSwipe = absX > 35 || absY > 45;

      if (isQuickFlick || isNormalSwipe) {
        if (absX >= absY) {
          step(dx < 0 ? 1 : -1);
        } else {
          step(dy < 0 ? 1 : -1);
        }
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [step, enabled]);

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
  // Read once — no state, no re-renders on resize
  const isMobile =
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

  const duration = reduced ? "0.25s" : isMobile ? "0.38s" : "1.1s";
  const easing = isMobile
    ? "cubic-bezier(0.22, 1, 0.36, 1)"
    : "cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="flex h-dvh w-max overflow-x-hidden"
        style={{
          transform: `translateX(calc(-${index} * 100vw))`,
          transition: `transform ${duration} ${easing}`,
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
