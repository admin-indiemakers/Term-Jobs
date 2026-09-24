export const SECTION_LABELS = [
  "HOME",
  "WHY TERMJOBS",
  "HOW IT WORKS",
  "FOR TALENT",
  "FOR TEAMS",
  "GET STARTED",
];

export function SectionNavigation({
  index,
  dark,
  onSelect,
}: {
  index: number;
  dark: boolean;
  onSelect: (i: number) => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="fixed right-5 bottom-5 z-40 md:right-10 md:bottom-8"
      style={{ color: dark ? "var(--color-paper)" : "var(--color-ink)" }}
    >
      <ul className="flex flex-wrap justify-end gap-x-5 gap-y-2 md:flex-col md:items-end md:gap-2">
        {SECTION_LABELS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={i === index ? "true" : undefined}
              className="text-[0.58rem] font-semibold tracking-[0.2em] uppercase transition-opacity duration-300 hover:opacity-100 focus-visible:ring-1 focus-visible:ring-current focus-visible:outline-none md:text-[0.62rem]"
              style={{ opacity: i === index ? 1 : 0.4 }}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
