import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function useCountUp(target: number, active: boolean, duration = 1600) {
  const [value, setValue] = useState(0);
  const reduced = useReducedMotion();
  const frame = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [active, target, duration, reduced]);

  return value;
}
