import type { Variants } from "framer-motion";

export const EASE = [0.16, 1, 0.3, 1] as const;

export const lineReveal: Variants = {
  hidden: { y: "110%", opacity: 0 },
  show: (i: number = 0) => ({
    y: "0%",
    opacity: 1,
    transition: { duration: 1, ease: EASE, delay: 0.1 + i * 0.12 },
  }),
};

export const fadeUp: Variants = {
  hidden: { y: 24, opacity: 0 },
  show: (i: number = 0) => ({
    y: 0,
    opacity: 1,
    transition: { duration: 0.9, ease: EASE, delay: 0.25 + i * 0.09 },
  }),
};

export const softFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.8, ease: EASE } },
};
