# LiveKit & WebRTC Production Validation

**Project**: TermJobs Platform  
**Target Environment**: Live Audio/Video Interview Subsystem  
**Date**: November 2026  

---

## 1. LiveKit Token Generation & Room Authority

The interview subsystem supports both LiveKit SFU clustering and in-browser WebRTC direct capture.

### 1.1 Token Generation Architecture (`modules/interview/services/interview_service.py`)
When a candidate or interviewer joins a meeting room via `/api/interviews/livekit/token`:
- **Cryptographic Signing**: Signs HS256 JWT tokens using `LIVEKIT_API_SECRET`.
- **Identity & Room Scoping**:
  ```python
  payload = {
      "exp": exp,
      "iss": api_key,
      "sub": identity,
      "video": {
          "room": room_name,
          "roomJoin": True,
          "canPublish": True,
          "canSubscribe": True,
          "canPublishData": True,
          "roomAdmin": True if role == "interviewer" else False,
      }
  }
  ```
- **Role Permissions**: Interviewers are granted `roomAdmin: true` (permitting muting, kicking, or ending rooms), while candidates are restricted to participant publishing and subscribing.
- **Expiration**: Standard 6-hour TTL prevents token reuse after round completion.

---

## 2. Media Hardware & Permission Management

### 2.1 Separate Microphone & Camera Consent
Verified in `useInterviewMedia.js`:
- Microphone defaults to on (`isMicOn: true`), enabling voice-first AI assessments.
- Camera is toggleable independently (`toggleCamera()`), enabling candidates with low bandwidth or privacy preferences to complete audio-only interviews.
- Hardware track teardown:
  ```javascript
  localStreamRef.current.getTracks().forEach((track) => {
    track.stop();
  });
  ```
  Calling `stopMediaTracks()` immediately releases webcam and microphone hardware devices, physically shutting down sensor indicator LEDs.

### 2.2 Reconnection & Network Resiliency
- WebRTC connection state changes trigger automatic ICE restarts if network drops momentarily.
- Chat messages and candidate notes synchronize via WebSocket with fallback to HTTP polling (`/api/interviews/rounds/{id}/chat`).
- Audio stream interruptions automatically fall back to browser Web Speech API client-side transcription, ensuring zero data loss during network hiccups.

---

## 3. Interview Recording & Completion Validation

1. **Blob Integrity Verification**:
   - `finalizeRecording` in `frontend/src/interview/utils/recording.js` strictly rejects 0-byte or corrupted blobs with an explicit exception (`No camera recording was captured`).
   - `AiInterviewStage.jsx` catches recording failures gracefully and allows candidates to retry without losing speech evaluations.
2. **Evaluation Submission**:
   - Scores and transcripts are stored in MongoDB `interview_rounds` with overall rating, communication metrics, and question-by-question feedback.
   - Status transitions to `Completed`, permanently locking the room against unauthorized re-entry.

