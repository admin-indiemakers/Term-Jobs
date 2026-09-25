import { Link } from "react-router-dom";
import logo from "@/assets/termjobs-logo.png";

export function BrandMark({ dark, onHomeClick }: { dark: boolean; onHomeClick?: () => void }) {
  return (
    <header className="absolute top-0 inset-x-0 z-40 px-6 py-5 md:px-12 md:py-6 flex items-center justify-between pointer-events-none">
      {/* Brand logo & name */}
      <button
        type="button"
        onClick={onHomeClick}
        className="pointer-events-auto flex items-center gap-3 group transition-transform hover:scale-102 focus-visible:outline-none cursor-pointer"
      >
        <img
          src={logo}
          alt="TermJobs"
          className="h-7 w-7 object-contain transition-[filter] duration-700 md:h-8 md:w-8"
          style={{ filter: dark ? "invert(1)" : "none" }}
        />
        <span
          className="text-[0.7rem] font-extrabold tracking-[0.34em] transition-colors duration-700 uppercase"
          style={{ color: dark ? "var(--color-paper)" : "var(--color-ink)" }}
        >
          TERMJOBS
        </span>
      </button>

      {/* Top right navigation links */}
      <div className="pointer-events-auto flex items-center gap-2.5">
        <Link
          to="/open-roles"
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.65rem] font-bold tracking-[0.16em] uppercase transition-all duration-300 border backdrop-blur-xl active:scale-95 ${
            dark
              ? "bg-white/[0.08] hover:bg-white/[0.14] border-white/20 text-paper shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)]"
              : "bg-white/70 hover:bg-white/90 border-ink/12 hover:border-ink/25 text-ink shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.8)]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current/60 animate-pulse" />
          <span>Open Roles</span>
        </Link>

        <Link
          to="/login"
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.65rem] font-bold tracking-[0.16em] uppercase transition-all duration-300 border backdrop-blur-xl active:scale-95 ${
            dark
              ? "bg-paper/90 hover:bg-paper text-ink border-white/25 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)]"
              : "bg-ink/90 hover:bg-ink text-paper border-ink/20 shadow-[0_4px_16px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.2)]"
          }`}
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}
