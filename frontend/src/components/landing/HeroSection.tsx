import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Backdrop } from "./Backdrop";
import { EASE, fadeUp, lineReveal } from "./animations";
import { useCountUp } from "./useCountUp";

const stats = [
  { label: "Active Requirements", value: 24, suffix: "" },
  { label: "Verified Talent", value: 1284, suffix: "" },
  { label: "AI Matches", value: 94, suffix: "%" },
  { label: "Active Engagements", value: 86, suffix: "" },
];

function Stat({ label, value, suffix, active }: (typeof stats)[number] & { active: boolean }) {
  const n = useCountUp(value, active);
  return (
    <div className="rounded-xl border border-ink/10 bg-paper/70 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[0.6rem] font-semibold tracking-[0.18em] text-ink-soft uppercase">
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-ink/60"
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        {label}
      </div>
      <div className="mt-3 text-3xl font-extrabold tracking-tight text-ink tabular-nums">
        {n.toLocaleString()}
        {suffix}
      </div>
    </div>
  );
}

export function HeroSection({ active, onNext }: { active: boolean; onNext: () => void }) {
  const reduced = useReducedMotion();
  const state = active ? "show" : "hidden";

  return (
    <section
      aria-label="Hero"
      className="relative flex h-dvh w-screen shrink-0 items-start md:items-center overflow-y-auto overscroll-contain md:overflow-hidden bg-paper text-ink"
    >
      <Backdrop />
      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-12 px-6 pt-28 pb-32 md:px-12 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-0 lg:pb-0">
        <div>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate={state}
            className="mb-8 text-[0.65rem] font-semibold tracking-[0.3em] text-ink-soft uppercase"
          >
            Contract workforce platform
          </motion.p>

          <h1 className="font-display text-[clamp(2rem,5.4vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em]">
            <span className="block overflow-hidden">
              <motion.span
                className="block"
                variants={lineReveal}
                custom={0}
                initial="hidden"
                animate={state}
              >
                BUILD YOUR TEAM.
              </motion.span>
            </span>
            <span className="block overflow-hidden">
              <motion.span className="block text-haze" variants={lineReveal} custom={1} initial="hidden" animate={state}>
                WITHOUT THE HIRING DELAY.
              </motion.span>
            </span>
          </h1>

          <motion.p
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate={state}
            className="mt-7 max-w-lg text-sm leading-relaxed text-ink-soft md:text-base"
          >
            Submit your requirements and let TermJobs find, screen and deliver verified contract talent — so you can start your project faster.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={2}
            initial="hidden"
            animate={state}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/open-roles"
              className="group inline-flex items-center gap-2.5 rounded-full bg-ink/90 hover:bg-ink text-paper px-7 py-3.5 text-[0.7rem] font-semibold tracking-[0.18em] uppercase transition-all duration-300 hover:-translate-y-0.5 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.3)] active:scale-95 cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-paper/90 animate-pulse" />
              <span>Explore Open Roles</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <button
              type="button"
              onClick={onNext}
              className="group inline-flex items-center gap-3 rounded-full bg-white/70 hover:bg-white/90 text-ink px-7 py-3.5 text-[0.7rem] font-semibold tracking-[0.18em] uppercase transition-all duration-300 hover:-translate-y-0.5 backdrop-blur-xl border border-ink/15 hover:border-ink/30 shadow-[0_8px_25px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] active:scale-95 cursor-pointer"
            >
              Get started
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
            <button
              type="button"
              onClick={onNext}
              className="group inline-flex items-center gap-3 rounded-full bg-white/35 hover:bg-white/60 text-ink/80 hover:text-ink px-7 py-3.5 text-[0.7rem] font-semibold tracking-[0.18em] uppercase transition-all duration-300 hover:-translate-y-0.5 backdrop-blur-md border border-ink/10 hover:border-ink/25 shadow-[0_4px_16px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.6)] active:scale-95 cursor-pointer"
            >
              How it works
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
          </motion.div>
        </div>

        {/* Product visualization */}
        <motion.div
          initial={{ opacity: 0, y: 48, rotate: reduced ? 0 : -1.6 }}
          animate={active ? { opacity: 1, y: 0, rotate: 0 } : { opacity: 0, y: 48 }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
          className="relative"
        >
          <div className="rounded-2xl border border-ink/10 bg-paper/80 p-5 shadow-[0_40px_90px_-50px_oklch(0.2_0_0/0.45)] backdrop-blur-md md:p-6">
            <div className="flex items-center justify-between border-b border-ink/10 pb-4">
              <span className="text-[0.62rem] font-semibold tracking-[0.24em] text-ink uppercase">
                Workforce Overview
              </span>
              <span className="text-[0.6rem] tracking-[0.2em] text-ink-soft uppercase">Live</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {stats.map((s) => (
                <Stat key={s.label} {...s} active={active} />
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
              transition={{ duration: 0.9, ease: EASE, delay: 1.1 }}
              className="mt-4 rounded-xl border border-ink/12 bg-ink p-4 text-paper"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[0.6rem] tracking-[0.2em] text-paper/60 uppercase">Match found</div>
                  <div className="mt-1.5 text-sm font-bold">Senior Data Engineer · 8 months</div>
                </div>
                <div className="text-xl font-extrabold tabular-nums">96%</div>
              </div>
              <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-paper/20">
                <motion.div
                  className="h-full bg-paper"
                  initial={{ width: "0%" }}
                  animate={active ? { width: "96%" } : { width: "0%" }}
                  transition={{ duration: 1.4, ease: EASE, delay: 1.3 }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
