import { motion, useReducedMotion } from "framer-motion";

/** Understated background system: soft radial light, blurred forms, grid + grain. */
export function Backdrop({ tone = "light" }: { tone?: "light" | "dark" | "sidebar" }) {
  const reduced = useReducedMotion();
  const dark = tone === "dark";
  const isSidebar = tone === "sidebar";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: dark
            ? "radial-gradient(120% 90% at 20% 10%, oklch(0.26 0.004 260) 0%, oklch(0.13 0.004 260) 55%, oklch(0.1 0.004 260) 100%)"
            : isSidebar
              ? "radial-gradient(130% 90% at 0% 0%, oklch(1 0 0) 0%, oklch(0.975 0.002 100) 50%, oklch(0.94 0.002 100) 100%)"
              : "radial-gradient(110% 85% at 80% 0%, oklch(1 0 0) 0%, oklch(0.975 0.002 100) 55%, oklch(0.94 0.002 100) 100%)",
        }}
      />
      <div
        className={`grid-layer absolute inset-0 ${dark ? "text-paper" : "text-ink"}`}
        style={{
          opacity: dark ? 0.5 : 0.7,
          backgroundPosition: isSidebar ? "calc(-100vw) 0" : "0 0",
        }}
      />
      {isSidebar ? (
        <>
          <motion.div
            className="absolute -top-32 -left-20 h-[32rem] w-[32rem] rounded-full blur-3xl"
            style={{
              background: "radial-gradient(circle, oklch(0.78 0.004 260 / 0.45), transparent 70%)",
            }}
            animate={reduced ? {} : { x: [0, 40, 0], y: [0, 30, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -left-32 bottom-[-10rem] h-[30rem] w-[30rem] rounded-full blur-3xl"
            style={{
              background: "radial-gradient(circle, oklch(0.84 0.004 260 / 0.5), transparent 70%)",
            }}
            animate={reduced ? {} : { x: [0, -30, 0], y: [0, -20, 0] }}
            transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : (
        <>
          <motion.div
            className="absolute -top-40 -left-32 h-[38rem] w-[38rem] rounded-full blur-3xl"
            style={{
              background: dark
                ? "radial-gradient(circle, oklch(0.45 0.004 260 / 0.35), transparent 70%)"
                : "radial-gradient(circle, oklch(0.78 0.004 260 / 0.45), transparent 70%)",
            }}
            animate={reduced ? {} : { x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -right-40 bottom-[-12rem] h-[34rem] w-[34rem] rounded-full blur-3xl"
            style={{
              background: dark
                ? "radial-gradient(circle, oklch(0.38 0.004 260 / 0.4), transparent 70%)"
                : "radial-gradient(circle, oklch(0.84 0.004 260 / 0.5), transparent 70%)",
            }}
            animate={reduced ? {} : { x: [0, -50, 0], y: [0, -30, 0] }}
            transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}
      {isSidebar ? (
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 500 800">
          {[0, 1, 2].map((i) => (
            <motion.path
              key={i}
              d={`M-20 ${240 + i * 160} C 120 ${190 + i * 150}, 300 ${320 + i * 120}, 520 ${260 + i * 150}`}
              fill="none"
              stroke="oklch(0.2 0 0 / 0.08)"
              strokeWidth="1"
              animate={reduced ? {} : { d: [
                `M-20 ${240 + i * 160} C 120 ${190 + i * 150}, 300 ${320 + i * 120}, 520 ${260 + i * 150}`,
                `M-20 ${260 + i * 160} C 140 ${220 + i * 150}, 320 ${290 + i * 120}, 520 ${290 + i * 150}`,
                `M-20 ${240 + i * 160} C 120 ${190 + i * 150}, 300 ${320 + i * 120}, 520 ${260 + i * 150}`,
              ] }}
              transition={{ duration: 22 + i * 5, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </svg>
      ) : (
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1200 800">
          {[0, 1, 2].map((i) => (
            <motion.path
              key={i}
              d={`M-100 ${260 + i * 150} C 250 ${180 + i * 140}, 600 ${420 + i * 90}, 1300 ${240 + i * 160}`}
              fill="none"
              stroke={dark ? "oklch(0.98 0 0 / 0.1)" : "oklch(0.2 0 0 / 0.08)"}
              strokeWidth="1"
              animate={reduced ? {} : { d: [
                `M-100 ${260 + i * 150} C 250 ${180 + i * 140}, 600 ${420 + i * 90}, 1300 ${240 + i * 160}`,
                `M-100 ${290 + i * 150} C 280 ${250 + i * 140}, 640 ${340 + i * 90}, 1300 ${300 + i * 160}`,
                `M-100 ${260 + i * 150} C 250 ${180 + i * 140}, 600 ${420 + i * 90}, 1300 ${240 + i * 160}`,
              ] }}
              transition={{ duration: 22 + i * 5, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </svg>
      )}
      <div className="grain-layer absolute inset-0" style={{ opacity: dark ? 0.1 : 0.14 }} />
    </div>
  );
}
