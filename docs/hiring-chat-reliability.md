# Hiring chat reliability

## Findings and implemented changes

The generic unavailable response hid authentication, rate-limit, network, timeout,
and invalid-completion failures. A synthetic request succeeded against the configured
provider during investigation; this does not establish the cause of an earlier failure.

- Requisition queries containing “with shortlisted candidates” now join authorized
  requisitions and applications directly and return requisition cards with counts.
- On a model failure, explicit staffing requests such as “I need a DevOps engineer
  with 2 years experience starting work next month” retain those details in an
  incomplete preview. No requisition is saved or submitted by this recovery path.
- Optional null tool arguments are omitted before validation and dispatch. Required
  fields, argument types, enums, and truncated completions remain validated.
- Attempts allow up to 12 seconds within the remaining completion budget, instead
  of reducing each attempt to a quarter of the remaining time. Optional summaries
  share the model-stage deadline. Database/tool time is not a hard request deadline.
- Exhausted model requests expose a failure category and reference. Server logs
  include the same reference, model, and HTTP status without credentials, provider
  response bodies, tool arguments, or conversation text.

## Verification and release

Run the hiring chat recovery, model transport, read action, and creation intent
pytest suites. The recovery suite uses the real authorization wrapper and an
in-memory database to verify company and manager isolation. Model transport tests
inject HTTP failures and validate a real draft tool response through dispatch.

After backend restart/deployment, test both screenshot requests in the portal.
Confirm the running backend and frontend correspond to the intended branch.
Verify shortlist counts against the manager's records and confirm a recovered
staffing request remains an incomplete preview with explicit missing fields.

## Recurrence investigation and next work

Use the reference attached to a failed response to locate its server log. Handle
configuration/authentication failures through deployment configuration; investigate
rate limits against the configured provider account; inspect timeout frequency
and invalid-response frequency separately. Do not replay write tools automatically.

Next, add aggregate metrics per failure category and latency; extend explicit read
routing as supported queries are identified; and persist active draft state with
idempotent submission keys. These follow-ups require their own tests and rollout.
Do not claim all model-dependent operations are outage-proof: content generation
and unsupported natural-language requests still require a working provider.
