import { motion } from "framer-motion";
import { Backdrop } from "./Backdrop";
import { EASE, fadeUp, lineReveal } from "./animations";

const features = [
  {
    n: "01",
    title: "REQUIREMENTS & ENGAGEMENTS",
    body: "Create and manage workforce requirements and active engagements in one place.",
  },
  {
    n: "02",
    title: "TIMESHEETS & TRACKING",
    body: "Track hours, attendance and engagement activity without spreadsheets.",
  },
  {
    n: "03",
    title: "BILLING & VISIBILITY",
    body: "Keep workforce costs, invoices and project activity visible in one platform.",
  },
];

export function FeaturesSection({ active }: { active: boolean }) {
  const state = active ? "show" : "hidden";

  return (
    <section
      aria-label="For teams"
      className="relative flex h-dvh w-screen shrink-0 items-start md:items-center overflow-y-auto overscroll-contain md:overflow-hidden bg-paper text-ink"
    >
      <Backdrop />
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-28 pb-32 md:px-12">
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          className="mb-8 text-[0.65rem] font-semibold tracking-[0.3em] text-ink-soft uppercase"
        >
          05 — For teams
        </motion.p>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <h2 className="font-display text-[clamp(1.8rem,4.4vw,3.4rem)] leading-[1.02] font-extrabold tracking-[-0.03em]">
            {["EVERYTHING", "YOUR WORKFORCE", "NEEDS."].map((line, i) => (
              <span key={line} className="block overflow-hidden">
                <motion.span className="block" variants={lineReveal} custom={i} initial="hidden" animate={state}>
                  {line}
                </motion.span>
              </span>
            ))}
          </h2>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate={state}
            className="text-[0.7rem] font-semibold tracking-[0.26em] text-haze uppercase"
          >
            One connected workforce.
          </motion.p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.article
              key={f.n}
              initial={{ opacity: 0, y: 26 }}
              animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.55 + i * 0.16 }}
              tabIndex={0}
              className="group relative overflow-hidden rounded-2xl border border-ink/12 bg-paper/70 p-7 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-ink/35 hover:bg-paper hover:shadow-[0_40px_70px_-50px_oklch(0.2_0_0/0.45)] focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none md:p-8"
            >
              <span className="text-[0.62rem] font-bold tracking-[0.24em] text-haze tabular-nums">{f.n}</span>
              <h3 className="mt-6 text-base leading-snug font-extrabold tracking-[-0.01em] transition-transform duration-500 group-hover:translate-x-1 md:text-lg">
                {f.title}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft transition-transform duration-500 group-hover:translate-x-1">
                {f.body}
              </p>
              <span className="mt-8 inline-flex translate-x-[-6px] items-center text-lg opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                →
              </span>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
