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

The updated script writes eight waiting-list columns: Timestamp, Form type
(`Waitlist`), Name, Email, Company name, Phone number, Requirements, and How did
you find us? Add the last two column headers and update the deployed Web app to
use this version of `Code.gs` for separate columns. Requirements and referral
source are optional; only name and email are required.

Until the script is redeployed, the backend also includes requirements and referral
source as labeled lines in the legacy `message` column, alongside the phone number.
This preserves the new details with the existing six-column deployed script.
The payload includes separate `requirements` and `referral_source` fields as well.
Existing Contact and Talent Network submissions retain their current format.
Repeated submissions append another row; the script does not deduplicate emails.

The Talent Network branch requires Drive authorization using `authorizeDrive`.
A missing or blank environment setting uses the supplied default URL. An invalid
override or script error returns an error to the form, never a false success.
