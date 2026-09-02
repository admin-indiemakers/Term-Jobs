# 📅 Comprehensive Research: 100% Free Calendar Integration & Cal.diy (Open-Source Cal.com) Architecture

This document provides a comprehensive research report on integrating calendar and scheduling systems into **Term-Jobs**, featuring an in-depth analysis of the open-source **`calcom/cal.diy`** repository, its hosting requirements, embed capabilities, and comparison with native direct synchronization.

---

## 🔍 1. What is `calcom/cal.diy`?

[`calcom/cal.diy`](https://github.com/calcom/cal.diy) is the community-driven, 100% **MIT-licensed open-source edition** of the **Cal.com** scheduling engine (an open-source alternative to Calendly).

### Key Features of Cal.diy:
* **True Open-Source (MIT License)**: Free from commercial licensing or open-core restrictions.
* **Calendly-style Booking Pages**: Dynamic links like `https://schedule.yourcompany.com/interviewer/round1`.
* **Two-Way Calendar Sync**: Integrates with Google Calendar, Microsoft Outlook, and Apple iCloud to check real-time availability and block busy slots.
* **Automatic Video Links**: Auto-generates Google Meet, Zoom, or Microsoft Teams meeting rooms.
* **Embedded UI Widgets**: Provides `@calcom/embed-react` to render interactive booking calendars directly inside React SPA dashboards without leaving the page.

---

## ⚖️ 2. Comprehensive Comparison: Native Term-Jobs Engine vs `calcom/cal.diy`

| Feature / Metric | Native Term-Jobs Calendar Engine (Current) | Cal.diy (Self-Hosted Cal.com) | Cal.com Free Cloud Plan |
| :--- | :--- | :--- | :--- |
| **Licensing & Cost** | **$0.00 (100% Free Forever)** | **$0.00 (MIT License)** | **$0.00 (Free Individual Plan)** |
| **Infrastructure Needed** | **Zero extra servers** (Runs directly inside FastAPI + MongoDB) | Requires **Next.js + Node.js + PostgreSQL + Redis** | No server needed (Hosted on cal.com) |
| **Hosting Impact on Free Tier** | ⚡ **Ultra-lightweight** (Fits easily into Render 512MB RAM free tier) | ⚠️ **Heavy** (Needs ~1GB RAM + PostgreSQL database for Prisma ORM) | ⚡ **Lightweight** (Only iframe/script embed) |
| **Candidate/Vendor Workflow** | Hiring Manager proposes slots ➔ Vendor clicks "Confirm" ➔ 1-Click Sync | Interviewer shares link ➔ Candidate/Vendor picks from live calendar slots | Interviewer shares link ➔ Candidate/Vendor picks from live calendar slots |
| **Real-time Busy Slot Detection** | Proposed manually by Hiring Manager | ✅ **Automatic** (Checks interviewer's Google/Outlook calendar) | ✅ **Automatic** |
| **1-Click Direct Calendar Links** | ✅ **Google, Outlook, Zoho, .ICS** | ✅ **Google, Outlook, Apple, .ICS** | ✅ **Google, Outlook, Apple, .ICS** |
| **Setup Complexity** | ⭐ **Instant (Zero configuration)** | ⚠️ **High (Deploy Next.js + Postgres + OAuth Apps)** | ⭐ **Low (Paste Cal.com username/link)** |

---

## 🛠️ 3. How to Use `calcom/cal.diy` in Term-Jobs: 3 Integration Approaches

### 🌟 Approach A: The "Best of Both Worlds" Hybrid Model (Recommended)
Keep Term-Jobs fast and lightweight on free cloud hosting while unlocking Cal.diy / Cal.com capabilities:
1. **Built-in Native Scheduler (Default)**:
   * 100% free, zero external servers.
   * Hiring Manager proposes date/time slots ➔ Vendor confirms ➔ Generates 1-Click Google, Outlook, Zoho, and `.ics` links.
2. **Optional Cal.diy / Cal.com Embed Widget**:
   * If the Company Admin or Hiring Manager inputs their **Cal.diy / Cal.com handle** (e.g. `https://cal.com/sarah-jenkins/interview`), Term-Jobs automatically renders the **interactive embedded booking calendar** inside the Shortlisted Candidates modal!
   * The Vendor / Candidate can book an available slot directly inside Term-Jobs.

---

### 💻 Approach B: Embedding Cal.com / Cal.diy in React

Using the official `@calcom/embed-react` or lightweight iframe:

```jsx
import { useEffect } from 'react';
import Cal, { getCalApi } from "@calcom/embed-react";

export function CalDiyBookingWidget({ calLink = "sarah-jenkins/interview" }) {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi();
      cal("ui", {
        theme: "light",
        styles: { branding: { brandColor: "#2563eb" } },
        hideEventTypeDetails: false,
        layout: "month_view"
      });
    })();
  }, []);

  return (
    <Cal
      calLink={calLink}
      style={{ width: "100%", height: "100%", overflow: "scroll" }}
      config={{ layout: "month_view" }}
    />
  );
}
```

---

### 🏗️ Approach C: Full Self-Hosted Cal.diy Microservice

If you want a dedicated, standalone instance of `calcom/cal.diy`:

```
 ┌───────────────────────────┐         ┌───────────────────────────┐
 │   TERM-JOBS MAIN APP      │         │   SELF-HOSTED CAL.DIY     │
 │   • FastAPI Backend       │ ◄─────► │   • Next.js App           │
 │   • React Frontend        │ (REST / │   • PostgreSQL DB         │
 │   • MongoDB Atlas         │ Webhook)│   • Google / Outlook APIs │
 └───────────────────────────┘         └───────────────────────────┘
```

#### Self-Hosting Steps on Render / Vercel:
1. **Fork `calcom/cal.diy`** on GitHub.
2. **Provision Free PostgreSQL Database** on [Neon.tech](https://neon.tech/) or [Supabase](https://supabase.com/) (100% Free PostgreSQL).
3. **Deploy on Vercel / Render**:
   * Set `DATABASE_URL`: `postgres://user:password@neon.tech/cal_db`
   * Set `NEXTAUTH_SECRET`: `<random-secret>`
   * Set `NEXT_PUBLIC_WEBAPP_URL`: `https://cal.yourdomain.com`
   * Run Prisma migrations: `npx prisma migrate deploy`
4. In Term-Jobs **Company Admin Dashboard**, paste the self-hosted Cal.diy base URL (`https://cal.yourdomain.com`).

---

## 🎯 4. Summary & Recommendation for Term-Jobs

1. **For Production Deployment on Free Hosting**:
   * Running a separate Next.js + PostgreSQL Cal.diy server consumes extra hosting resources.
   * **Recommendation**: Use our **Native 1-Click Engine** (Google, Outlook, Zoho, .ICS) as the core system, with **Cal.diy / Cal.com Link Support** enabled for teams that want interactive live-availability booking.
2. **Zero Maintenance**:
   * Our native solution generates instant Google Calendar / Outlook web intent URLs + standard `.ics` with **$0.00 hosting cost**, **zero rate limits**, and **no server maintenance**.
