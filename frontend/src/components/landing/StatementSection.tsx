import { motion } from "framer-motion";
import { Backdrop } from "./Backdrop";
import { EASE, fadeUp, lineReveal } from "./animations";

export function StatementSection({ active }: { active: boolean }) {
  const state = active ? "show" : "hidden";

  return (
    <section
      aria-label="Why TermJobs"
      className="relative flex h-dvh w-screen shrink-0 items-center overflow-y-auto overscroll-contain md:overflow-hidden bg-ink text-paper"
    >
      <Backdrop tone="dark" active={active} />

      {/* Main content — centered on mobile, full width */}
      <div className="relative z-10 mx-auto flex flex-col justify-center w-full max-w-7xl px-6 pt-20 pb-24 md:px-12 lg:pt-0 lg:pb-0 min-h-dvh md:min-h-0">

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          className="mb-6 sm:mb-8 text-[0.62rem] sm:text-[0.65rem] font-semibold tracking-[0.3em] text-paper/45 uppercase"
        >
          02 — Why TermJobs
        </motion.p>

        <h2 className="font-display text-[clamp(2rem,5.4vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] max-w-4xl">
          <span className="block overflow-hidden">
            <motion.span
              className="block"
              variants={lineReveal}
              custom={0}
              initial="hidden"
              animate={state}
            >
              STOP SEARCHING.
            </motion.span>
          </span>
          <span className="block overflow-hidden">
            <motion.span
              className="block"
              variants={lineReveal}
              custom={1}
              initial="hidden"
              animate={state}
            >
              START SELECTING.
            </motion.span>
          </span>
          <span className="block overflow-hidden mt-3">
            <motion.span
              className="block text-paper/40"
              variants={lineReveal}
              custom={2}
              initial="hidden"
              animate={state}
            >
              LET TERMJOBS HANDLE THE WORK IN BETWEEN.
            </motion.span>
          </span>
        </h2>

        <motion.p
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate={state}
          className="mt-6 sm:mt-8 max-w-xl text-sm leading-relaxed text-paper/60 md:text-base"
        >
          From candidate sourcing to screening and shortlisting, TermJobs takes the repetitive work off your team so you can focus on choosing the right person.
        </motion.p>

        {/* 3 badges as seen in Image 3 */}
        <motion.div
          variants={fadeUp}
          custom={2}
          initial="hidden"
          animate={state}
          className="mt-6 sm:mt-8 flex flex-wrap items-center gap-2 sm:gap-2.5"
        >
          {["REQUIREMENT", "TALENT NETWORK", "YOUR SELECTION"].map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-paper/15 bg-paper/[0.05] px-3.5 sm:px-4 py-1.5 sm:py-2 text-[0.6rem] sm:text-[0.65rem] font-semibold tracking-[0.16em] sm:tracking-[0.18em] text-paper/75 uppercase backdrop-blur-md"
            >
              {badge}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Tagline — anchored top-right, treated as ambient caption */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.4, ease: EASE, delay: 0.8 }}
        className="absolute top-20 right-6 z-10 hidden md:right-12 md:flex"
      >
        <div className="flex flex-col gap-1 text-right">
          {["YOUR REQUIREMENT.", "OUR WORKFORCE NETWORK.", "YOUR DECISION."].map((line) => (
            <span
              key={line}
              className="text-[0.58rem] font-semibold tracking-[0.22em] text-paper/25 uppercase"
            >
              {line}
            </span>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
