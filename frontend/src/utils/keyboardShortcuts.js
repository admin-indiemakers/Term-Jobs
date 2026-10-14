/**
 * Helper to determine keyboard shortcut display for search focus across OS platforms.
 * On macOS / iOS, returns '⌘ K'. On Windows / Linux / other platforms, returns 'Ctrl K'.
 */
export function getSearchShortcutKey() {
  if (typeof navigator === 'undefined') return 'Ctrl K';
  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /(Mac|iPhone|iPod|iPad)/i.test(platform) ? '⌘ K' : 'Ctrl K';
}
