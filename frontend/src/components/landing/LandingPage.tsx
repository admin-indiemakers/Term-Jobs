import { useEffect } from "react";
import { ArrowControl } from "./ArrowControl";
import { BrandMark } from "./BrandMark";
import { FeaturesSection } from "./FeaturesSection";
import { FinalCTA } from "./FinalCTA";
import { HeroSection } from "./HeroSection";
import { HorizontalScroller, useHorizontalPanels } from "./HorizontalScroller";
import { PageProgress } from "./PageProgress";
import { SectionNavigation } from "./SectionNavigation";
import { StatementSection } from "./StatementSection";
import { TalentSection } from "./TalentSection";
import { WorkflowSection } from "./WorkflowSection";

const TOTAL = 6;
const DARK_SECTIONS = new Set([1, 5]);

export function LandingPage() {
  const { index, goTo, step } = useHorizontalPanels(TOTAL);
  const dark = DARK_SECTIONS.has(index);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const isLast = index === TOTAL - 1;

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-paper">
      <HorizontalScroller index={index}>
        <HeroSection active={index === 0} onNext={() => step(1)} />
        <StatementSection active={index === 1} />
        <WorkflowSection active={index === 2} />
        <TalentSection active={index === 3} />
        <FeaturesSection active={index === 4} />
        <FinalCTA active={index === 5} />
      </HorizontalScroller>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-28 transition-opacity duration-700 md:h-24"
        style={{
          background: dark
            ? "linear-gradient(to top, oklch(0.13 0.004 260) 22%, transparent)"
            : "linear-gradient(to top, oklch(0.975 0.002 100) 22%, transparent)",
        }}
      />

      <BrandMark dark={dark} onHomeClick={() => goTo(0)} />
      <PageProgress index={index} total={TOTAL} dark={dark} />
      <SectionNavigation index={index} dark={dark} onSelect={goTo} />
      <ArrowControl isLast={isLast} dark={dark} onClick={() => (isLast ? goTo(0) : step(1))} />
    </main>
  );
}
