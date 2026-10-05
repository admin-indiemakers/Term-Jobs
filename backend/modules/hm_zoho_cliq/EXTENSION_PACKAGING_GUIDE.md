# Packaging TermJobs Bot as a Zoho Cliq Extension (Cross-Organization Guide)

## Why Can't People Outside Your Organization See the Bot?
By default, bots created in the Zoho Cliq Developer Console are scoped strictly to the **creator's Zoho Organization**. If a user or hiring manager belongs to a different Zoho account or external company, Zoho blocks them with *"Bot not found"*.

To allow users from **any external company or Zoho organization** to use the bot with 1-click installation, you must package the bot as a **Zoho Cliq Extension**.

---

## 3-Minute Packaging Steps in Zoho Developer Console

### Step 1: Open Zoho Cliq Developer Console
- For India DC: [https://cliq.zoho.in/developer](https://cliq.zoho.in/developer)
- For Global/US DC: [https://cliq.zoho.com/developer](https://cliq.zoho.com/developer)

### Step 2: Create a New Extension
1. On the left navigation sidebar, click **Extensions** (under *Build*).
2. Click **Create Extension** (or **+**).
3. Fill in the basic info:
   - **Extension Name:** `TermJobs AI Hiring Assistant`
   - **Description:** `AI assistant for job requisitions, candidate reviews, timesheets, and interview scheduling.`
   - **Category:** `Human Resources` / `Productivity`

### Step 3: Attach the Existing Bot
1. Inside your new Extension, click **Components** > **Bots**.
2. Click **Associate Bot** or select your existing bot (`hiringmanagerterm` or your custom bot).
3. Verify that the **Message Handler** points to your TermJobs webhook:
   ```
   https://<YOUR_API_DOMAIN>/api/zoho-cliq/webhook
   ```
   *(or `/api/zoho-cliq/webhook/{tenant_id}` for dedicated company tenants)*

### Step 4: Generate the Shareable Installation Link
1. In the top right corner of your Extension details page, click **Publish** or **Share**.
2. Under **Access Type**, choose **Private Sharing** (or submit to Zoho Marketplace for global public listing).
3. Zoho generates a universal installation link, for example:
   ```
   https://cliq.zoho.in/install/extension?key=termjobs_assistant_xyz
   ```

### Step 5: Save Link in TermJobs Dashboard
1. Go to your **TermJobs Dashboard** > **Company Profile** > **Bot Integrations**.
2. Under Zoho Cliq, paste the URL into **Universal Extension Install Link**.
3. Click **Save Configuration**.

---

## What Happens When External Users Click the Link?
1. Zoho Cliq displays an instant 1-click modal: **"Install Extension: TermJobs AI Hiring Assistant"**.
2. The user selects their Zoho organization and clicks **Install**.
3. The bot is immediately available in their organization's Cliq sidebar!
4. The user sends any message (`hi` or `show requisitions`), and TermJobs automatically pairs their hiring manager profile by email.
