export function ArrowControl({
  isLast,
  dark,
  onClick,
}: {
  isLast: boolean;
  dark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLast ? "Back to first section" : "Next section"}
      className="group fixed top-1/2 right-5 z-40 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border backdrop-blur-sm transition-all duration-500 hover:scale-105 focus-visible:ring-2 focus-visible:outline-none md:right-10 md:h-14 md:w-14"
      style={{
        borderColor: dark ? "oklch(0.98 0 0 / 0.3)" : "oklch(0.2 0 0 / 0.2)",
        color: dark ? "var(--color-paper)" : "var(--color-ink)",
        background: dark ? "oklch(0.98 0 0 / 0.06)" : "oklch(1 0 0 / 0.55)",
      }}
    >
      <span
        className={`text-lg transition-transform duration-500 ${isLast ? "group-hover:-translate-x-1" : "group-hover:translate-x-1"}`}
      >
        {isLast ? "←" : "→"}
      </span>
    </button>
  );
}
