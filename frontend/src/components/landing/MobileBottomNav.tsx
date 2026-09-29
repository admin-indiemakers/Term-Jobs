import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SECTION_LABELS } from "./SectionNavigation";

interface MobileBottomNavProps {
  index: number;
  total: number;
  dark: boolean;
  onSelect: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  isLast: boolean;
}

export function MobileBottomNav({
  index,
  total,
  dark,
  onSelect,
  onPrev,
  onNext,
  isLast,
}: MobileBottomNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const activeLabel = SECTION_LABELS[index] || "HOME";

  return (
    <div className="fixed bottom-4 inset-x-3.5 sm:inset-x-6 z-50 md:hidden select-none pb-[env(safe-area-inset-bottom,0px)]">
      {/* Quick Jump Popover Menu Sheet */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            />

            {/* Menu Sheet */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`absolute bottom-16 inset-x-0 z-50 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-2xl ${
                dark
                  ? "bg-[oklch(0.14_0.005_260/0.75)] border-white/20 text-paper shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]"
                  : "bg-white/70 border-white/90 text-ink shadow-[0_20px_50px_rgba(0,0,0,0.12),inset_0_1px_2px_rgba(255,255,255,0.95)]"
              }`}
            >
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-current/10 px-1">
                <span className="text-[0.62rem] font-bold tracking-[0.2em] uppercase opacity-60">
                  Jump to Section
                </span>
                <span className="text-[0.6rem] font-semibold opacity-40 tabular-nums">
                  {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {SECTION_LABELS.map((label, i) => {
                  const isActive = i === index;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        onSelect(i);
                        setMenuOpen(false);
                      }}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all active:scale-95 ${
                        isActive
                          ? dark
                            ? "bg-white/15 text-white font-bold"
                            : "bg-ink text-paper font-bold"
                          : dark
                            ? "hover:bg-white/5 text-paper/70"
                            : "hover:bg-ink/5 text-ink/75"
                      }`}
                    >
                      <span
                        className={`text-[0.55rem] font-mono tabular-nums ${
                          isActive ? "opacity-100" : "opacity-40"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[0.62rem] tracking-[0.14em] uppercase truncate">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Glassmorphic Capsule Dock */}
      <nav
        aria-label="Mobile section navigation"
        className={`relative z-40 flex items-center justify-between gap-2 rounded-full border px-4 py-2 backdrop-blur-2xl transition-all duration-500 ${
          dark
            ? "bg-[oklch(0.14_0.005_260/0.65)] hover:bg-[oklch(0.14_0.005_260/0.75)] border-white/20 text-paper shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.2)]"
            : "bg-white/55 hover:bg-white/70 border-white/80 text-ink shadow-[0_12px_40px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,0.95)]"
        }`}
      >
        {/* Left: Active Section Label (01 | HOME) */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-1.5 focus-visible:outline-none cursor-pointer group active:scale-95 transition-transform"
          aria-expanded={menuOpen}
          aria-label={`Current section: ${activeLabel}. Tap to jump to another section.`}
        >
          <span className="text-[0.58rem] font-normal font-mono tabular-nums opacity-60">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-[0.55rem] opacity-25 font-light mx-1">|</span>
          <span className="text-[0.56rem] font-normal tracking-[0.2em] uppercase truncate max-w-[85px] xs:max-w-[110px] sm:max-w-none opacity-65">
            {activeLabel}
          </span>
        </button>

        {/* Center: Slide Indicator Dots */}
        <div className="flex items-center gap-1.5 px-1">
          {Array.from({ length: total }).map((_, i) => {
            const isActive = i === index;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`Go to section ${i + 1}`}
                className="group relative flex h-6 w-3 sm:w-4 items-center justify-center p-0.5 focus-visible:outline-none cursor-pointer"
              >
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    isActive
                      ? "h-1.5 w-5 bg-current opacity-100"
                      : "h-1.5 w-1.5 bg-current opacity-25 group-hover:opacity-50"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right: Prev & Next Arrows */}
        <div className="flex items-center gap-2.5 pr-1">
          <button
            type="button"
            onClick={onPrev}
            disabled={index === 0}
            aria-label="Previous section"
            className={`flex items-center justify-center text-[0.85rem] transition-all cursor-pointer ${
              index === 0
                ? "opacity-20 pointer-events-none"
                : "opacity-60 hover:opacity-100 active:scale-90"
            }`}
          >
            ←
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label={isLast ? "Restart to beginning" : "Next section"}
            className="flex items-center justify-center text-[0.85rem] font-bold transition-all active:scale-90 cursor-pointer opacity-80 hover:opacity-100"
          >
            {isLast ? "↺" : "→"}
          </button>
        </div>
      </nav>
    </div>
  );
}
