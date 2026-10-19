# Connect the waiting list

The waiting-list form sends validated submissions through `POST /api/waitlist`
to your deployed Google Apps Script. It never stores entries in MongoDB.
Success is shown only when the script returns `{"status":"success"}`.

1. Use your existing spreadsheet-bound Apps Script (`Code.gs` in this folder).
2. Deploy as a Web app, execute as the spreadsheet owner, and allow Anyone access.
3. Your supplied deployed URL is included as the backend default. To change it,
   override it in the backend environment (including the hosting environment):

   ```dotenv
   WAITLIST_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```

4. Restart or redeploy the backend. No `WAITLIST_WEBHOOK_SECRET` is required by
   this script. Select the intended sheet before testing: the script writes to
   the active sheet of its bound spreadsheet.

The existing script's six columns receive Timestamp, Form type (`Waitlist`),
Name, Email, Company name (the `topic` field), Phone number (the `message` field).
The backend also sends `company_name` and `phone_number` for future script use.
Existing Contact and Talent Network submissions retain their current format.
Repeated submissions append another row; the script does not deduplicate emails.

The Talent Network branch requires Drive authorization using `authorizeDrive`.
A missing or blank environment setting uses the supplied default URL. An invalid
override or script error returns an error to the form, never a false success.
