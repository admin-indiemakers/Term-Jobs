import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Backdrop } from "./Backdrop";
import { EASE, fadeUp, lineReveal } from "./animations";

const roles = [
  { title: "Senior Full-Stack Engineer", meta: "Remote · 6 months", match: "94% match" },
  { title: "Product Marketing Lead", meta: "Hybrid · 12 months", match: "89% match" },
];

export function TalentSection({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const state = active ? "show" : "hidden";

  return (
    <section
      aria-label="Talent experience"
      className="relative flex h-dvh w-screen shrink-0 items-start md:items-center overflow-y-auto overscroll-contain md:overflow-hidden bg-paper text-ink"
    >
      <Backdrop />
      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-6 pt-28 pb-32 md:px-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:pt-0 lg:pb-0">
        <div>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate={state}
            className="mb-8 text-[0.65rem] font-semibold tracking-[0.3em] text-ink-soft uppercase"
          >
            04 — For talent
          </motion.p>
          <h2 className="font-display text-[clamp(2rem,5.6vw,4.4rem)] leading-[1] font-extrabold tracking-[-0.03em]">
            {["YOUR NEXT OPPORTUNITY,", "ONE STEP AWAY."].map((line, i) => (
              <span key={line} className="block overflow-hidden">
                <motion.span className="block" variants={lineReveal} custom={i} initial="hidden" animate={state}>
                  {line}
                </motion.span>
              </span>
            ))}
            <span className="block overflow-hidden">
              <motion.span className="block text-haze" variants={lineReveal} custom={2} initial="hidden" animate={state}>
                FIND WORK THAT FITS.
              </motion.span>
            </span>
          </h2>
          <motion.p
            variants={fadeUp}
            custom={2}
            initial="hidden"
            animate={state}
            className="mt-8 max-w-md text-sm leading-relaxed text-ink-soft md:text-base"
          >
            Create your profile, get matched with relevant contract roles, and manage your engagement from one place.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={3}
            initial="hidden"
            animate={state}
            className="mt-8"
          >
            <Link
              to="/open-roles"
              className="inline-flex items-center gap-3 rounded-full bg-ink px-7 py-3.5 text-[0.7rem] font-semibold tracking-[0.18em] text-paper uppercase transition-transform duration-300 hover:-translate-y-0.5 shadow-md hover:bg-ink/90 cursor-pointer"
            >
              Browse Open Positions
              <span>→</span>
            </Link>
          </motion.div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <motion.div
            initial={{ opacity: 0, y: 40, rotate: reduced ? 0 : 2 }}
            animate={active ? { opacity: 1, y: 0, rotate: reduced ? 0 : -1.2 } : { opacity: 0, y: 40 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.25 }}
          >
            <motion.div
              animate={reduced ? {} : { y: [0, -14, 0], rotate: [-1.2, -0.2, -1.2] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              className="w-[260px] rounded-[2.4rem] border border-ink/12 bg-paper p-3 shadow-[0_50px_90px_-45px_oklch(0.2_0_0/0.5)] sm:w-[300px]"
            >
              <div className="rounded-[2rem] border border-ink/8 bg-paper-dim p-5">
                <div className="mx-auto mb-6 h-1 w-14 rounded-full bg-ink/15" />
                <p className="text-[0.7rem] tracking-[0.12em] text-ink-soft uppercase">Good morning 👋</p>
                <h3 className="mt-2 text-xl font-extrabold tracking-tight">Find work that fits.</h3>
                <Link
                  to="/open-roles"
                  className="mt-5 block rounded-xl border border-ink/12 bg-paper px-3 py-2.5 text-xs text-ink-soft hover:border-ink/30 transition cursor-pointer"
                >
                  Search live roles...
                </Link>
                <div className="mt-4 space-y-3">
                  {roles.map((r, i) => (
                    <Link
                      key={r.title}
                      to="/open-roles"
                      className="block"
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                        transition={{ duration: 0.7, ease: EASE, delay: 0.7 + i * 0.22 }}
                        className="rounded-xl border border-ink/10 bg-paper p-3.5 hover:border-ink/30 transition shadow-xs"
                      >
                        <div className="text-[0.82rem] font-bold leading-snug">{r.title}</div>
                        <div className="mt-1 text-[0.68rem] text-ink-soft">{r.meta}</div>
                        <div className="mt-2.5 inline-flex rounded-full bg-ink px-2.5 py-1 text-[0.6rem] font-semibold tracking-[0.1em] text-paper uppercase">
                          {r.match}
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
