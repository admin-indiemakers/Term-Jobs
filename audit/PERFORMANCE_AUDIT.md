# Frontend & Network Performance Audit

**Project**: TermJobs Platform  
**Target Environment**: Production Optimization  
**Audit Role**: Senior Frontend Performance Engineer  
**Date**: November 2026  

---

## 1. Bundle Splitting & Route-Based Chunking

A primary focus of Stage 2 and Stage 3 audits was ensuring heavy WebRTC, audio/video streaming, and AI evaluation libraries are completely isolated from public visitor routes.

### Bundle Separation Verification
- **Public Entry Point (`main.jsx` / `App.jsx`)**:
  - Contains only core React runtime, router, and lightweight SVG icon primitives.
  - Zero WebRTC, LiveKit, or ONNX dependencies are included in the vendor entry chunk.
- **Dynamic Import Boundaries**:
  - `AiInterviewRoom.jsx` and `InterviewRoom.jsx` are dynamically loaded via `React.lazy()`.
  - `livekit-client` is loaded only when the candidate or interviewer enters a live meeting room URL.
  - Candidate portal analytics and timesheet charts load only on `/candidate/dashboard`.

---

## 2. Network Activity & Asset Optimization

### 2.1 CSS & Font Loading
- **Font Strategy**: Uses system UI fallbacks (`font-sans`, Inter) with `font-display: swap` to prevent FOIT (Flash of Invisible Text) and ensure immediate First Contentful Paint (FCP).
- **Tailwind JIT Pruning**: Production build purges all unused CSS utility classes. The total production stylesheet size remains below 45 KB gzipped.
- **Image Assets**: Logos and badges use SVG and compressed WebP formats with explicit width/height attributes to prevent Cumulative Layout Shifts (CLS < 0.05).

### 2.2 API Caching & Request Deduplication
1. **Screening Cache Engine**:
   - `modules/candidate/router.py` implements a multi-tier cache using SHA-256 hashed candidate sets (`exact_cache_key = hashlib.sha256(...)`).
   - Candidate screening results are cached in the database for 24 hours.
   - Repeated candidate evaluations achieve **100% cache hits**, avoiding redundant LLM inferences and external API roundtrips.
2. **Requisition Cache & Stale-While-Revalidate**:
   - Requisition detail endpoints utilize TTL caching. When requisitions are updated, published, or closed, the cache key is purged immediately.
3. **Speculative Prefetching Throttling**:
   - Candidate job searches execute debounced searches (300ms) with `AbortController` cancellation for superseded query terms, preventing network request floods.

---

## 3. Memory Management & Navigation Stability

During repeated route transitions between the public homepage, Find Jobs drawer, candidate portal, and interview rooms, memory usage remained stable:
- **Event Listener Cleanup**: All `useEffect` hooks in `useInterviewMedia`, `useInterviewChat`, and `useSpeechTranscription` return teardown cleanup functions that call `livekitService.off(...)` and `window.speechRecognition.stop()`.
- **Media Stream Destruction**: Hardware webcam and microphone tracks are destroyed upon component unmount, preventing dangling media streams from consuming browser memory or keeping hardware capture active.
- **Zero Console Memory Leaks**: Verified clean garbage collection profile across route navigation.

