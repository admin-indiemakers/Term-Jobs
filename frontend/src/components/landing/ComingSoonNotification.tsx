import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";

interface ComingSoonNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinWaitlist: () => void;
}

export function ComingSoonNotification({
  isOpen,
  onClose,
  onJoinWaitlist,
}: ComingSoonNotificationProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 8000);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -28, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.94, transition: { duration: 0.22 } }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="fixed top-3 sm:top-6 inset-x-3.5 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-auto sm:w-[460px] max-w-full pointer-events-auto"
        >
          {/* Pure Black & White Glassmorphic Container with outside click target ref */}
          <div
            ref={cardRef}
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-neutral-950/85 p-4 sm:p-5 text-white shadow-[0_24px_70px_-10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.35)] backdrop-blur-2xl"
          >
            {/* Top ambient crystalline sheen */}
            <div
              aria-hidden="true"
              className="absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-60 rounded-full bg-white/10 blur-2xl pointer-events-none"
            />

            <div className="relative flex items-start gap-3 sm:gap-3.5">
              {/* Glass monochrome lock badge */}
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-white/20 bg-white/[0.08] text-white shadow-[0_8px_24px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl">
                <Lock className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-white/90" />
              </div>

              {/* Text content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-white/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                  <span>Coming Soon </span>
                </div>
                <h4 className="mt-1 text-xs sm:text-sm font-extrabold tracking-tight text-white">
                  Open Roles Launching Soon
                </h4>
                <p className="mt-1 text-[0.72rem] sm:text-xs leading-relaxed text-neutral-300">
                  Enterprise contract listings are opening shortly. Join our verified waitlist now for early matching and prioritized access when doors open.
                </p>

                {/* Action button row */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onJoinWaitlist();
                    }}
                    className="group inline-flex items-center gap-1.5 rounded-full bg-white text-neutral-950 px-3.5 sm:px-4 py-1.5 sm:py-2 text-[0.65rem] sm:text-[0.7rem] font-bold uppercase tracking-[0.14em] hover:bg-neutral-200 transition-all active:scale-95 shadow-[0_6px_20px_rgba(255,255,255,0.18)] cursor-pointer"
                  >
                    <span>Join the Waitlist</span>
                    <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </button>

                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
