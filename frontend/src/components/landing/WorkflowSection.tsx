import { motion } from "framer-motion";
import { Backdrop } from "./Backdrop";
import { EASE, fadeUp, lineReveal } from "./animations";

const steps = [
  "REQUIREMENT",
  "SOURCING",
  "INTERVIEW",
  "SELECTION",
  "CONTRACT LIFECYCLE",
  "RENEW / OFFBOARD",
];

export function WorkflowSection({ active }: { active: boolean }) {
  const state = active ? "show" : "hidden";

  return (
    <section
      aria-label="How it works"
      className="relative flex h-dvh w-screen shrink-0 items-start md:items-center overflow-y-auto overscroll-contain md:overflow-hidden bg-paper-dim text-ink"
    >
      <Backdrop />
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-28 pb-32 md:px-12">
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          className="mb-8 text-[0.65rem] font-semibold tracking-[0.3em] text-ink-soft uppercase"
        >
          03 — How it works
        </motion.p>
        <h2 className="font-display max-w-3xl text-[clamp(1.8rem,4.6vw,3.6rem)] leading-[1.02] font-extrabold tracking-[-0.03em]">
          {["ONE PLATFORM", "FOR THE COMPLETE"].map((line, i) => (
            <span key={line} className="block overflow-hidden">
              <motion.span className="block" variants={lineReveal} custom={i} initial="hidden" animate={state}>
                {line}
              </motion.span>
            </span>
          ))}
          <span className="block overflow-hidden">
            <motion.span className="block text-haze" variants={lineReveal} custom={2} initial="hidden" animate={state}>
              WORKFORCE JOURNEY.
            </motion.span>
          </span>
        </h2>

        <ol className="mt-14 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {steps.map((step, i) => (
            <motion.li
              key={step}
              initial={{ opacity: 0, y: 18 }}
              animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.5 + i * 0.13 }}
              className="relative"
            >
              <div className="flex items-center">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/25 text-[0.6rem] font-bold tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {i < steps.length - 1 && (
                  <motion.span
                    className="ml-2 hidden h-px origin-left bg-ink/25 lg:block lg:w-full"
                    initial={{ scaleX: 0 }}
                    animate={active ? { scaleX: 1 } : { scaleX: 0 }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.62 + i * 0.13 }}
                  />
                )}
              </div>
              <p className="mt-3 text-[0.66rem] font-semibold tracking-[0.14em] uppercase">{step}</p>
            </motion.li>
          ))}
        </ol>

        <motion.p
          variants={fadeUp}
          custom={4}
          initial="hidden"
          animate={state}
          className="mt-14 max-w-xl text-sm leading-relaxed text-ink-soft"
        >
          From requirement to invoice — with an intelligent layer running quietly across every stage,
          and people still making the decisions that matter.
        </motion.p>
      </div>
    </section>
  );
}
