# Company isolation audit — 16 October 2026

## Result and limits

Confirmed unauthorized data-access paths existed in the reviewed code. Local fixes and regression tests cover the paths listed below. This is not a certification that the entire application or deployed service is leak-free. No production deployment, access-log investigation, or live database repair was performed.

## Read-only database observations

The configured database contains five requisitions, four candidate submissions, and ten interview rounds. The accounts h@why.com and hr@termjobs.in have different tenant IDs and no shared requisition IDs or submission IDs.

Both accounts have accepted applications for the same candidate email. Two applications under h@why.com use candidate_id CND-909d22d9, which is also an application ID under hr@termjobs.in. These are ambiguous cross-company references; their intended meaning needs validation against the original submission/import workflow before any repair. The scan found no interview-round tenant_id mismatches against their linked requisitions. Neither observation establishes whether private information was historically accessed.

## Fixed locally

- Candidate interview enrichment and completed-interview verification match by requisition as well as candidate identity.
- Candidate listing, status changes, deletion, and resume access enforce application ownership. Company staff cannot delete shared vendor candidate profiles. Unowned bank profiles are no longer visible through an empty-tenant fallback.
- Onboarding requires authentication, checks application ownership before detail or mutation endpoints, scopes checklist/issue lists and AI context, and derives administrative privileges from the authenticated account.
- Offboarding HTTP routes check candidate-application access.
- Interview round detail, recordings, communication analysis, chat, mutations, room tokens, and WebSocket connections require company access or an exact invitation. Legacy schedule IDs are checked against company/vendor ownership.
- Email alone is no longer an interview portal credential. Login credentials restrict the returned rounds rather than collecting every application with the same email. Candidate and staff portals omit the other participant's invitation credential.
- Interview recording playback uses a short-lived, round-specific media credential rather than placing the account token in the video URL.
- Vendor interview lists use stable vendor IDs rather than partial company names or generic vendor labels.
- Work-order lists/autofill and director agreement lists use company/requisition IDs. HTTP detail and mutation routes reject foreign or ambiguous identifiers.
- Screening detail and submission check requisition ownership or vendor engagement.
- Super Admin AI chat/stats and voice-agent sessions require a verified Super Admin. Company Admin AI no longer accepts a client-supplied identity.
- Hiring Manager chat sample histories were removed in the earlier fix; account changes reset chat state.

## Validation and follow-up

Regression tests simulate separate companies, managers, a repeated candidate email, forged administrative roles, foreign record IDs, and anonymous requests. Tests use an isolated mock database, not live mutations. The frontend production build is also checked.

Before claiming production remediation, deploy the fixes and verify real account workflows, including candidate invitations, recording playback, vendor submissions, onboarding, and director approvals. Legacy workflows that depend on a shared profile ID, missing ownership, or a company-name fallback now fail closed and may need an explicit application/ownership mapping. Review access logs to investigate historical exposure. The two live cross-company references remain unchanged. Billing, integrations, calendar/provider credentials, candidate-portal aggregation, and every main.py endpoint have not received an exhaustive endpoint-by-endpoint audit in this pass.
