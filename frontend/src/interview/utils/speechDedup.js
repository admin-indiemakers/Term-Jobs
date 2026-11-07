/**
 * Speech Recognition Deduplication and Sanitization Helpers for Term-Jobs
 *
 * Resolves Chromium / Web Speech API quirks:
 * - Duplicate event.results emissions
 * - Overlapping consecutive interim/final speech hypothesis revisions
 * - Appending full speech onto itself when final transcript differs only by trailing words
 * - Word stutter/repetition artifacts from continuous interim streams
 */

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'in',
  'on',
  'at',
  'to',
  'of',
  'is',
  'it',
  'we',
  'i',
  'uh',
  'um',
]);

export function cleanWord(w) {
  return (w || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Collapses immediate duplicate words (e.g. "i i" -> "i", "and and" -> "and")
 * that often occur during fast interim speech recognition updates.
 */
export function collapseWordStutters(text) {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  const result = [];
  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    const prev = result[result.length - 1];
    if (prev && cleanWord(prev) === cleanWord(current) && cleanWord(current).length > 0) {
      continue;
    }
    result.push(current);
  }
  return result.join(' ');
}

/**
 * Merges previous text with incoming new transcript, intelligently detecting:
 * 1. Direct duplicates or prefix/suffix containment
 * 2. Revision/refinement of the same spoken utterance (e.g. 40%+ matching prefix)
 * 3. Overlapping phrases (suffix of prev matches prefix of next)
 * 4. Distinct consecutive sentences (appends cleanly with single space)
 */
export function deduplicateOverlap(prev, next) {
  const p = (prev || '').trim();
  const n = (next || '').trim();

  if (!p) return n;
  if (!n) return p;
  if (p === n) return p;

  const pLower = p.toLowerCase();
  const nLower = n.toLowerCase();

  // If next completely subsumes prev from the start
  if (nLower.startsWith(pLower)) return n;
  // If prev already contains next from the start
  if (pLower.startsWith(nLower)) return p;

  const wordsP = p.split(/\s+/);
  const wordsN = n.split(/\s+/);

  // 1. Detect if next is a revised hypothesis of prev (same utterance prefix)
  let commonPrefixWords = 0;
  while (
    commonPrefixWords < wordsP.length &&
    commonPrefixWords < wordsN.length &&
    cleanWord(wordsP[commonPrefixWords]) === cleanWord(wordsN[commonPrefixWords])
  ) {
    commonPrefixWords++;
  }

  // If >= 40% of the shorter text matches starting at word 0 (with at least 3 matching words),
  // this is a revised version of the same utterance produced by the speech model!
  const minLen = Math.min(wordsP.length, wordsN.length);
  if (minLen >= 3 && commonPrefixWords >= Math.ceil(minLen * 0.4)) {
    return wordsN.length >= wordsP.length ? n : p;
  }

  // 2. Check suffix of prev overlapping prefix of next (stitched speech segments)
  const maxOverlap = Math.min(wordsP.length, wordsN.length, 12);
  for (let len = maxOverlap; len >= 1; len--) {
    const prevSlice = wordsP.slice(-len).map(cleanWord).join(' ');
    const nextSlice = wordsN.slice(0, len).map(cleanWord).join(' ');
    if (prevSlice === nextSlice && prevSlice.length > 0) {
      if (len === 1) {
        const singleWord = prevSlice;
        if (STOP_WORDS.has(singleWord) || singleWord.length < 4) {
          continue;
        }
      }
      return wordsP.concat(wordsN.slice(len)).join(' ');
    }
  }

  return p + ' ' + n;
}

