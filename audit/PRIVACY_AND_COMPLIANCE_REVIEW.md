# Privacy, Data Protection & Regulatory Compliance Review

**Project**: TermJobs Platform  
**Target Environment**: Regulatory Compliance Gate (India DPDP Act & Global Standards)  
**Date**: November 2026  

---

## 1. Candidate Consent & Media Privacy

The TermJobs platform enforces explicit, transparent candidate consent across all onboarding and evaluation workflows:

### 1.1 Hardware Permission & Sensor Privacy
- **Independent Microphone & Camera Consent**:
  - Voice-first assessments default microphone access to enabled (`isMicOn: true`), while camera capture requires an explicit secondary toggle (`isCameraOn: false` by default).
  - Candidates may attend interviews and complete voice screening without turning on video.
- **Physical Sensor LED Deactivation**:
  - In `useInterviewMedia.js`, unmounting or exiting the interview room explicitly calls `track.stop()` on all local audio and video tracks:
    ```javascript
    localStreamRef.current.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (_) {}
    });
    ```
  - This physically halts device sensor capture and powers down camera indicator LEDs, preventing background listening or covert recording.

---

## 2. Personal Data & Resume Access Scoping

1. **Candidate Resume Redaction & Scoping**:
   - Recruiters only see resumes of candidates submitted under their agency's vendor agreement.
   - Hiring Managers only see candidate profiles formally shortlisted or submitted to their own tenant's open requisitions.
   - Unauthenticated visitors on `/jobs` and `/open-roles` have **zero access** to candidate resumes, evaluations, or contact information.
2. **Interview Recordings & Transcript Retention**:
   - WebM interview recordings and AI-generated transcripts are cryptographically bound to `interview_rounds.round_id`.
   - Access to recording playback is restricted to authorized company hiring managers and super administrators.

---

## 3. Account Deletion, Offboarding & Data Retention

1. **48-Hour Offboarding Grace Period**:
   - When offboarding is initiated, candidates receive a strict 48-hour access grace period (`access_expires_at`).
   - Upon expiration, `login_user` rejects authentication attempts with **HTTP 403 Forbidden**.
2. **Immediate Timesheet Freezing**:
   - Marking offboarding as completed immediately sets `timesheet_frozen: True`, blocking further timesheet logging or expense claims.
3. **Email Archival & Account Anonymization**:
   - Offboarded candidate emails are archived (`offboarded_<timestamp>_<email>`), liberating corporate email addresses while preserving audit trails for compliance.
4. **Right to be Forgotten**:
   - User profile deletion routines scrub personal phone numbers, resume PDFs, and address fields upon formal candidate request, while maintaining anonymized timesheet ledgers required for tax and financial audits (Indian Income Tax Act Section 194J compliance).

---

## 4. Legal Framework & Terms Availability

- Formal terms, privacy disclosures, and staffing agreements are permanently hosted on dedicated public pages:
  - **Privacy Policy**: [`/privacy-policy`](https://termjobs.in/privacy-policy)
  - **Terms & Conditions**: [`/terms-and-conditions`](https://termjobs.in/terms-and-conditions)
  - **Platform Rules**: [`/platform-rules`](https://termjobs.in/platform-rules)
  - **Resources & Trust Center**: [`/resources`](https://termjobs.in/resources)

