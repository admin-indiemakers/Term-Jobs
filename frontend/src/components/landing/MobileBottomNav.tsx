interface MobileBottomNavProps {
  index: number;
  total: number;
  dark: boolean;
  onSelect: (i: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  isLast?: boolean;
}

export function MobileBottomNav({
  index,
  total,
  dark,
  onSelect,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Section dots navigation"
      className="fixed inset-x-0 bottom-[calc(0.65rem+env(safe-area-inset-bottom,0px))] md:bottom-2.5 z-40 flex justify-center items-center pointer-events-none select-none"
      style={{ color: dark ? "var(--color-paper)" : "var(--color-ink)" }}
    >
      <div className="flex items-center gap-2 pointer-events-auto">
        {Array.from({ length: total }).map((_, i) => {
          const isActive = i === index;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Go to section ${i + 1}`}
              aria-current={isActive ? "true" : undefined}
              className="group relative flex h-6 w-3.5 items-center justify-center focus-visible:outline-none cursor-pointer"
            >
              <span
                className={`block rounded-full transition-all duration-300 ${
                  isActive
                    ? "h-2 w-2 bg-current opacity-100 scale-100"
                    : "h-1.5 w-1.5 bg-current opacity-25 group-hover:opacity-50"
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
