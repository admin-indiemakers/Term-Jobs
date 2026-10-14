
# Calendar access, reservations, and reminders

Google Calendar access is scoped to the authenticated manager's connected primary calendar. The existing `calendar.events` permission covers reading events and booking; reconnect only if access has expired or permissions were revoked.

Enable **Google Calendar API** in Google Cloud Console → APIs & Services → Library in the same project that owns `GOOGLE_CLIENT_ID`. OAuth sign-in can succeed while the Calendar API remains disabled. Google then returns `403 accessNotConfigured` / `SERVICE_DISABLED`; reconnecting alone cannot fix it. After enabling the API, retry the availability check. Permission, authorization, and rate-limit failures have separate recovery messages.

Scheduling phrases such as `setup a interview with him today at 4pm` produce a proposal rather than listing today's interviews. Pronouns resolve from recent conversation names only within the manager's authorized requisition applications. Ambiguous candidates require an explicit name. Requested fields remain editable if Calendar cannot be read; dispatch still requires a successful conflict check.

Chat reads today's or tomorrow's meetings in the connected calendar's timezone. Questions about interviews filter for interview events. Events are read live, including recurring instances and all-day busy events. Empty results and calendar failures are reported separately.

Booking and rescheduling check both Google Calendar and the manager's TermJobs interviews before changing a round or emailing its invitation. Transparent events, declined invitations, and the round's own Google event do not conflict. A MongoDB lease serializes concurrent TermJobs reservations by the same manager. Successful Google events are marked busy. Google cannot make the application's conflict check atomic with unrelated edits made directly in Google Calendar.

Explicit chat requests such as `book an interview with Don Binoy tomorrow at 3pm for 45 minutes` can reserve a slot. The server derives the date and time from the actual request, validates the candidate's company application, and does not accept invented model dates. Other scheduling requests produce an editable proposal.

Google events request an organizer email reminder 60 minutes before and popup reminder 10 minutes before. Durable TermJobs jobs email candidates 60 and 10 minutes before; an interviewer who is not the calendar organizer also receives these emails. Failed calendar reservations do not arm email reminders. Rescheduling cancels old pending jobs, and cancelled or completed rounds do not send reminders.

The regular FastAPI server runs the reminder dispatcher every minute. On serverless hosting, configure an external scheduler to call `GET /api/calendar/reminders/run` every minute with `Authorization: Bearer <CRON_SECRET>`. Set the same strong `CRON_SECRET` on the backend. The endpoint is disabled when the secret is missing. SMTP configuration is required for candidate emails. Google-native organizer reminders do not depend on this worker.

The dispatcher uses atomic claims to avoid parallel delivery and retries failures up to three times. An SMTP acceptance followed by a process crash can still result in a duplicate on retry; exactly-once email delivery is not guaranteed.
