import { motion, useReducedMotion } from "framer-motion";
import { Building2, Users } from "lucide-react";
import { Backdrop } from "./Backdrop";
import { EASE, fadeUp, lineReveal } from "./animations";
import { HeroVideo } from "./HeroVideo";

export function HeroSection({ active, onJoinWaitlist, onJoinTalentPool }: { active: boolean; onJoinWaitlist: () => void; onJoinTalentPool: () => void }) {
  const reduced = useReducedMotion();
  const state = active ? "show" : "hidden";

  return (
    <section
      aria-label="Hero"
      className="relative flex h-dvh w-screen max-w-full shrink-0 items-center overflow-y-auto overflow-x-hidden overscroll-contain md:overflow-hidden bg-paper text-ink"
    >
      <Backdrop active={active} />
      <div className="relative z-10 mx-auto flex flex-col justify-center w-full max-w-7xl px-6 pt-20 pb-24 md:px-12 lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-0 lg:pb-0">
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
            {/* Dark glassmorphic button - Join Waitlist */}
            <button
              type="button"
              onClick={onJoinWaitlist}
              aria-haspopup="dialog"
              className="group inline-flex items-center gap-2.5 sm:gap-3 rounded-full bg-ink/80 hover:bg-ink/90 text-paper px-6 sm:px-7 py-3 sm:py-3.5 text-[0.68rem] sm:text-[0.7rem] font-semibold tracking-[0.16em] sm:tracking-[0.18em] uppercase transition-all duration-300 hover:-translate-y-0.5 backdrop-blur-2xl border border-white/20 shadow-[0_12px_36px_rgba(0,0,0,0.22),inset_0_1px_1.5px_rgba(255,255,255,0.35)] active:scale-95 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-paper/90 shrink-0" />
              <span className="h-3.5 w-px bg-current/25 shrink-0" aria-hidden="true" />
              <span>Join Waitlist</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>

            {/* Light glassmorphic button - Join Talent */}
            <button
              type="button"
              onClick={onJoinTalentPool}
              aria-haspopup="dialog"
              className="group inline-flex items-center gap-2.5 sm:gap-3 rounded-full border border-ink/20 bg-white/60 px-6 sm:px-7 py-3 sm:py-3.5 text-[0.68rem] sm:text-[0.7rem] font-semibold tracking-[0.16em] sm:tracking-[0.18em] text-ink uppercase backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/40 hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink active:scale-95 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-ink/85 shrink-0" />
              <span className="h-3.5 w-px bg-current/25 shrink-0" aria-hidden="true" />
              <span>Join Talent</span>
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
          </motion.div>
        </div>

        {/* Product visualization — desktop only */}
        <motion.div
          initial={{ opacity: 0, y: 48, rotate: reduced ? 0 : -1.6 }}
          animate={active ? { opacity: 1, y: 0, rotate: 0 } : { opacity: 0, y: 48 }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
          className="relative hidden lg:block"
        >
          <HeroVideo active={active} />
        </motion.div>
      </div>
    </section>
  );
}
