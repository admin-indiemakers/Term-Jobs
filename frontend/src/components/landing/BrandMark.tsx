import { Link } from "react-router-dom";
import logo from "@/assets/termjobs-logo.png";

export function BrandMark({ dark, onHomeClick }: { dark: boolean; onHomeClick?: () => void }) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 px-6 py-5 md:px-12 md:py-6 flex items-center justify-between pointer-events-none">
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
      <div className="pointer-events-auto flex items-center gap-3">
        <Link
          to="/open-roles"
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.65rem] font-bold tracking-[0.16em] uppercase transition-all duration-300 border shadow-xs ${
            dark
              ? "bg-paper/10 border-paper/20 text-paper hover:bg-paper/20"
              : "bg-ink/5 border-ink/15 text-ink hover:bg-ink/10"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Open Roles</span>
        </Link>

        <Link
          to="/login"
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.65rem] font-bold tracking-[0.16em] uppercase transition-all duration-300 border ${
            dark
              ? "bg-paper text-ink border-transparent hover:bg-paper/90"
              : "bg-ink text-paper border-transparent hover:bg-ink/90"
          }`}
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}
