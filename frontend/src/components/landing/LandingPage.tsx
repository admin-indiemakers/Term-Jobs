import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowControl } from "./ArrowControl";
import { BrandMark } from "./BrandMark";
import { ComingSoonNotification } from "./ComingSoonNotification";
import { FeaturesSection } from "./FeaturesSection";
import { FinalCTA } from "./FinalCTA";
import { HeroSection } from "./HeroSection";
import { HorizontalScroller, useHorizontalPanels } from "./HorizontalScroller";
import { MobileBottomNav } from "./MobileBottomNav";
import { PageProgress } from "./PageProgress";
import { SectionNavigation } from "./SectionNavigation";
import { StatementSection } from "./StatementSection";
import { TalentSection } from "./TalentSection";
import { WaitlistModal } from "./WaitlistModal";
import { WorkflowSection } from "./WorkflowSection";

const TOTAL = 6;
const DARK_SECTIONS = new Set([1, 5]);

export function LandingPage({ enabled = true }: { enabled?: boolean }) {
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [talentOpen, setTalentOpen] = useState(false);

  const openTalent = useCallback(() => setTalentOpen(true), []);
  const closeTalent = useCallback(() => setTalentOpen(false), []);
  const openWaitlist = useCallback(() => setWaitlistOpen(true), []);
  const closeWaitlist = useCallback(() => setWaitlistOpen(false), []);

  const isModalActive = showComingSoon || waitlistOpen || talentOpen;
  const { index, goTo, step } = useHorizontalPanels(TOTAL, enabled && !isModalActive);
  const dark = DARK_SECTIONS.has(index);

  useEffect(() => {
    if (!enabled) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [enabled]);

  const isLast = index === TOTAL - 1;

  return (
    <main className="relative h-dvh w-screen max-w-full overflow-hidden bg-paper">
      <HorizontalScroller index={index}>
        <HeroSection
          active={index === 0}
          onJoinWaitlist={openWaitlist}
          onJoinTalentPool={openTalent}
        />
        <StatementSection active={index === 1} />
        <WorkflowSection active={index === 2} />
        <TalentSection
          active={index === 3}
          onOpenRolesClick={() => setShowComingSoon(true)}
        />
        <FeaturesSection active={index === 4} />
        <FinalCTA
          active={index === 5}
          onOpenRolesClick={() => setShowComingSoon(true)}
        />
      </HorizontalScroller>

      {enabled && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-28 transition-opacity duration-700 md:h-24"
            style={{
              background: dark
                ? "linear-gradient(to top, oklch(0.13 0.004 260) 22%, transparent)"
                : "linear-gradient(to top, oklch(0.975 0.002 100) 22%, transparent)",
            }}
          />

          <BrandMark
            dark={dark}
            onHomeClick={() => goTo(0)}
            onOpenRolesClick={() => setShowComingSoon(true)}
            onJoinWaitlist={openWaitlist}
          />

          {/* Desktop Navigation (completely untouched for md and up) */}
          <div className="hidden md:block">
            <PageProgress index={index} total={TOTAL} dark={dark} />
            <SectionNavigation index={index} dark={dark} onSelect={goTo} />
            <ArrowControl isLast={isLast} dark={dark} onClick={() => (isLast ? goTo(0) : step(1))} />
          </div>

          <footer
            className="absolute inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-40 flex justify-center px-3 md:bottom-3 md:px-36"
            style={{ color: dark ? "var(--color-paper)" : "var(--color-ink)" }}
          >
            <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] sm:text-xs">
              <Link to="/privacy-policy" className="py-2 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2">Privacy Policy</Link>
              <Link to="/terms-and-conditions" className="py-2 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2">Terms & Conditions</Link>
              <Link to="/platform-rules" className="py-2 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2">Platform Rules</Link>
            </nav>
          </footer>

          {/* Mobile Bottom Navigation Capsule */}
          <MobileBottomNav
            index={index}
            total={TOTAL}
            dark={dark}
            onSelect={goTo}
            onPrev={() => step(-1)}
            onNext={() => (isLast ? goTo(0) : step(1))}
            isLast={isLast}
          />
        </>
      )}

      {/* Small Coming Soon popup with Join Waitlist navigation */}
      <ComingSoonNotification
        isOpen={showComingSoon}
        onClose={() => setShowComingSoon(false)}
        onJoinWaitlist={() => {
          setShowComingSoon(false);
          openWaitlist();
        }}
      />

      {/* Waitlist Modal (same modal used by HeroSection onJoinWaitlist) */}
      {talentOpen && <WaitlistModal onClose={closeTalent} talent />}
      {waitlistOpen && <WaitlistModal onClose={closeWaitlist} />}
    </main>
  );
}
