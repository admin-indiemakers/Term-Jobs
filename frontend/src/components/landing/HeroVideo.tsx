import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import videoUrl from '../../assets/workforce-loop.mp4';
import posterUrl from '../../assets/workforce-poster.webp';

export function HeroVideo({ active }: { active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useReducedMotion();
  const [desktop, setDesktop] = useState(false);
  const [visible, setVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const updateSize = () => setDesktop(media.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    updateSize();
    updateVisibility();
    media.addEventListener('change', updateSize);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      media.removeEventListener('change', updateSize);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  // Attach the source only when this desktop hero is actually shown.
  useEffect(() => {
    if (desktop && active) setLoaded(true);
  }, [desktop, active]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active && visible && !reducedMotion) {
      video.play().catch(() => { /* Keep the poster if autoplay is blocked. */ });
    } else {
      video.pause();
    }
  }, [active, visible, reducedMotion, desktop, loaded]);

  if (!desktop) return null;

  return (
    <figure aria-label="TermJobs platform preview" className="relative overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-[0_40px_90px_-50px_oklch(0.2_0_0/0.45)]">
      {failed || reducedMotion ? (
        <img src={posterUrl} alt="TermJobs platform preview" width={960} height={732} className="block h-auto w-full" />
      ) : (
        <video
          ref={videoRef}
          src={loaded ? videoUrl : undefined}
          poster={posterUrl}
          width={960}
          height={732}
          muted
          loop
          playsInline
          autoPlay={active}
          preload={active ? 'auto' : 'none'}
          onError={() => setFailed(true)}
          aria-hidden="true"
          className="block h-auto w-full"
        />
      )}

    </figure>
  );
}
