import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Backdrop } from "./Backdrop";
import { fadeUp, lineReveal } from "./animations";

export function FinalCTA({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const state = active ? "show" : "hidden";

  return (
    <section
      aria-label="Get started"
      className="relative flex h-dvh w-screen shrink-0 items-start justify-center md:items-center overflow-y-auto overscroll-contain md:overflow-hidden bg-ink text-paper"
    >
      <Backdrop tone="dark" />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.6 0.004 260 / 0.28), transparent 68%)" }}
        animate={reduced ? {} : { scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pt-28 pb-32 text-center md:px-12">
        <h2 className="font-display text-[clamp(2.2rem,6.4vw,5rem)] leading-[0.98] font-extrabold tracking-[-0.03em]">
          {["BUILD YOUR TEAM.", "MOVE FASTER."].map((line, i) => (
            <span key={line} className="block overflow-hidden">
              <motion.span
                className={i === 1 ? "block text-paper/45" : "block"}
                variants={lineReveal}
                custom={i}
                initial="hidden"
                animate={state}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h2>
        <motion.p
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate={state}
          className="mx-auto mt-8 max-w-xl text-sm leading-relaxed text-paper/60 md:text-base"
        >
          Whether you're hiring your next specialist or managing a flexible workforce, TermJobs keeps
          the entire engagement connected.
        </motion.p>
        <motion.div
          variants={fadeUp}
          custom={2}
          initial="hidden"
          animate={state}
          className="mt-11 flex flex-wrap items-center justify-center gap-3.5"
        >
          <Link
            to="/login"
            className="group inline-flex items-center gap-3 rounded-full bg-paper/90 hover:bg-paper text-ink px-7 py-3.5 text-[0.7rem] font-semibold tracking-[0.18em] uppercase transition-all duration-300 hover:-translate-y-0.5 backdrop-blur-xl border border-white/25 shadow-[0_8px_30px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)] active:scale-95 cursor-pointer"
          >
            For Companies & Teams
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
          <Link
            to="/open-roles"
            className="group inline-flex items-center gap-3 rounded-full bg-white/10 hover:bg-white/18 text-paper px-7 py-3.5 text-[0.7rem] font-semibold tracking-[0.18em] uppercase transition-all duration-300 hover:-translate-y-0.5 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)] active:scale-95 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-paper/85 animate-pulse" />
            <span>Explore Open Roles</span>
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
