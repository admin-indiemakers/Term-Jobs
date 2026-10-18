import React from 'react';
import termjobsLogo from '../assets/termjobs-logo.png';

/**
 * TermJobsLoader
 * Custom Term Jobs logo loading animation.
 *
 * Behavior:
 * - Transparent background (logo only, no container or badge).
 * -ist show lgo for 1 sec then
 * - Rotates 3 complete times (1080deg), then pauses for 1 second.
 * - Repeats continuously while loading.
 * - Supports light/white variant for dark buttons.
 * - Respects prefers-reduced-motion accessibility preferences.
 */
export function TermJobsLoader({
  size = 18,
  variant = 'default',
  className = '',
  style = {},
  ariaLabel = 'Loading...',
}) {
  const isWhite = variant === 'white' || variant === 'light' || variant === 'invert';
  const sizePx = typeof size === 'number' ? `${size}px` : size;

  return (
    <img
      src={termjobsLogo}
      alt={ariaLabel}
      role="status"
      aria-label={ariaLabel}
      className={`termjobs-logo-loader inline-block object-contain select-none pointer-events-none bg-transparent shrink-0 ${isWhite ? 'brightness-0 invert' : ''
        } ${className}`}
      style={{
        width: sizePx,
        height: sizePx,
        aspectRatio: '1 / 1',
        background: 'transparent',
        backgroundColor: 'transparent',
        ...style,
      }}
    />
  );
}

/**
 * TermJobsPageLoader
 * Centered page or section loader with the Term Jobs animated logo.
 */
export function TermJobsPageLoader({
  text = '',
  size = 36,
  fullScreen = false,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center select-none bg-transparent ${fullScreen ? 'min-h-screen w-full' : 'py-12 w-full'
        } ${className}`}
    >
      <TermJobsLoader size={size} />
      {text ? (
        <p className="text-xs font-semibold text-gray-500 tracking-tight mt-3">
          {text}
        </p>
      ) : null}
    </div>
  );
}

export default TermJobsLoader;
