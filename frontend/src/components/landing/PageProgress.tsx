import { motion } from "framer-motion";
import { EASE } from "./animations";

export function PageProgress({
  index,
  total,
  dark,
}: {
  index: number;
  total: number;
  dark: boolean;
}) {
  const color = dark ? "var(--color-paper)" : "var(--color-ink)";

  return (
    <>
      <div className="absolute top-0 right-0 left-0 z-40 h-[2px] bg-transparent">
        <motion.div
          className="h-full origin-left"
          style={{ background: color, opacity: 0.6 }}
          animate={{ scaleX: (index + 1) / total }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </div>
      <div
        className="absolute bottom-5 left-5 z-40 text-[0.62rem] font-semibold tracking-[0.24em] tabular-nums md:bottom-8 md:left-10"
        style={{ color }}
        aria-live="polite"
      >
        {String(index + 1).padStart(2, "0")}{" "}
        <span style={{ opacity: 0.4 }}>/ {String(total).padStart(2, "0")}</span>
      </div>
    </>
  );
}
