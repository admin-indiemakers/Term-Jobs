# 🚀 Complete 100% Free Hosting Guide: Term-Jobs & AI Resume Screener

This guide covers everything required to deploy the **Term-Jobs platform (React Frontend + FastAPI Backend + MongoDB Atlas + AI Resume Screening)** to the cloud **100% free forever**, without entering a credit card.

---

## 🏗️ Architecture Breakdown

```
 ┌─────────────────────────────────────────────────────────┐
 │               USER / BROWSER CLIENT                     │
 └─────────────┬─────────────────────────────┬─────────────┘
               │ (HTTPS)                     │ (HTTPS / API)
               ▼                             ▼
 ┌───────────────────────────┐ ┌───────────────────────────┐
 │  FRONTEND (React + Vite)  │ │   BACKEND (FastAPI / Py)  │
 │  Hosted on: VERCEL        │ │   Hosted on: RENDER       │
 │  (100% Free, Global CDN)  │ │   (100% Free Web Service) │
 └───────────────────────────┘ └──────┬─────────────┬──────┘
                                      │             │
                ┌─────────────────────┘             └────────────────────┐
                ▼                                                        ▼
 ┌───────────────────────────┐                        ┌───────────────────────────┐
 │   DATABASE (MongoDB)      │                        │  AI / LLM INFERENCE       │
 │   Hosted on: ATLAS M0     │                        │  Provider: GROQ CLOUD     │
 │   (512MB Free Forever)    │                        │  (14,400 Free Reqs/Day)   │
 └───────────────────────────┘                        └───────────────────────────┘
```

---

## 💡 The Key Challenge: Hosting Local Ollama vs Cloud LLM

| Component | In Local Development | In 100% Free Cloud Production |
| :--- | :--- | :--- |
| **LLM Inference** | `Ollama` running locally (`llama3.2:3b`) | **Groq Cloud API** (`llama-3.3-70b-versatile` or `llama-3.1-8b-instant`) |
| **Why?** | Local GPU / CPU is free. | Free hosting tiers (Render, Koyeb, Vercel) provide only **512MB RAM and 0 GPUs** — Ollama cannot run inside a 512MB free instance. |
| **Solution** | Use Ollama locally. | Use **Groq Cloud API** for production: **100% Free**, ultra-fast (500+ tokens/sec), no credit card required, generous 14,400 requests/day. |

---

## 📋 Best Free Tier Comparison

### 1. Frontend Hosting

| Provider | Free Tier Limits | Custom Domain | Cold Starts | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel** | 100 GB Bandwidth/mo, Unlimited builds | ✅ Yes (Free SSL) | ❌ None (Always On) | ⭐ **#1 Choice (Best for React/Vite)** |
| **Netlify** | 100 GB Bandwidth/mo, 300 build mins | ✅ Yes (Free SSL) | ❌ None (Always On) | ⭐ Good Alternative |
| **Cloudflare Pages** | Unlimited Bandwidth, 500 builds/mo | ✅ Yes (Free SSL) | ❌ None (Always On) | ⭐ Great Alternative |

---

### 2. Backend Hosting (Python FastAPI)

| Provider | Free Specs | Sleep / Inactivity | Recommendation |
| :--- | :--- | :--- | :--- |
| **Render.com** | 512 MB RAM, 0.1 CPU, 750 free hours/mo | Sleeps after 15 min idle (wakes in ~30s) | ⭐ **#1 Choice (Standard & Easiest)** |
| **Koyeb** | 512 MB RAM, 0.1 vCPU (Nano instance) | No sleep on Eco instance (1 free service) | ⭐ Good Alternative |
| **Railway** | $5 one-time free trial credit | Runs until credit exhausts | Good for initial demo |

---

### 3. Database Hosting (MongoDB)

| Provider | Free Tier Specs | Backup / Security | Recommendation |
| :--- | :--- | :--- | :--- |
| **MongoDB Atlas** | **M0 Free Tier**: 512 MB storage, shared RAM | Automatic SSL, TLS encryption, IP Whitelisting | ⭐ **#1 Choice (Free Forever)** |

---

### 4. Free AI / LLM Inference

| Provider | Free Tier Quota | Models Available | Speed |
| :--- | :--- | :--- | :--- |
| **Groq Cloud API** | **14,400 Requests/day**, 30 RPM, 30K TPM | Llama 3.3 70B, Llama 3.1 8B, DeepSeek R1, Mixtral | ⚡ **500+ tokens/sec (Fastest)** |
| **Google Gemini API** | **1,500 Requests/day**, 15 RPM, 1M TPM | Gemini 1.5 Flash, Gemini 2.0 Flash | ⚡ Very Fast |
| **OpenRouter** | 200 Requests/day (Free tier models) | Llama 3.2 3B, Mistral 7B | Moderate |

---

## 🛠️ Step-by-Step Deployment Walkthrough

### Step 1: Setup Free Database (MongoDB Atlas)
1. Log in to [cloud.mongodb.com](https://cloud.mongodb.com/).
2. Create a free **M0 Cluster** (Choose AWS / Frankfurt or Mumbai for best latency in India).
3. **Important — Network Access**:
   * Go to **Security** → **Network Access**.
   * Click **Add IP Address** → Select **Allow Access from Anywhere (`0.0.0.0/0`)**.
   * *(Render/Vercel dynamic IPs change constantly, so `0.0.0.0/0` is required).*
4. **Database Access**:
   * Create a database user (e.g., `termjobs_user` and a strong password).
5. **Get Connection String**:
   * Click **Connect** → **Drivers** → Copy connection string:
     `mongodb+srv://termjobs_user:<password>@cluster0.xxxxx.mongodb.net/termjobs?retryWrites=true&w=majority`

---

### Step 2: Get Free AI Key (Groq Cloud)
1. Go to [console.groq.com](https://console.groq.com/).
2. Sign up with Google/GitHub (No credit card needed).
3. Go to **API Keys** → Click **Create API Key**.
4. Copy your key (`gsk_xxxxxxxxxxxxxx`).

---

### Step 3: Prepare Backend for Cloud Deployment

Create a `requirements.txt` inside `backend/`:
```txt
fastapi>=0.115.0
uvicorn>=0.30.0
pydantic>=2.7.0
pydantic-settings>=2.3.0
python-multipart>=0.0.9
python-dotenv>=1.0.0
pymongo>=4.8.0
bcrypt>=4.1.0
pyjwt>=2.8.0
httpx>=0.27.0
PyMuPDF>=1.24.0
pdfplumber>=0.11.0
sentence-transformers>=3.0.0
rapidfuzz>=3.9.0
groq>=0.9.0
```

---

### Step 4: Deploy Backend to Render.com (100% Free)
1. Push your code to **GitHub**.
2. Go to [render.com](https://render.com/) and create a free account.
3. Click **New +** → **Web Service** → Connect your GitHub repository.
4. Set the configuration:
   * **Root Directory**: `backend`
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   * **Instance Type**: `Free` (512 MB RAM)
5. Add **Environment Variables** in Render Dashboard:
   * `MONGODB_URL`: `mongodb+srv://...` (your Atlas URI)
   * `MONGO_DB_NAME`: `termjobs`
   * `GROQ_API_KEY`: `gsk_...` (your Groq API key)
   * `LLM_PROVIDER`: `groq`
   * `JWT_SECRET_KEY`: `<any-random-long-secret-key>`
6. Click **Deploy Web Service**.
7. Render will provide a public URL: `https://termjobs-backend.onrender.com`.

---

### Step 5: Deploy Frontend to Vercel (100% Free)
1. Go to [vercel.com](https://vercel.com/) and log in with GitHub.
2. Click **Add New** → **Project** → Select your repository.
3. Set the configuration:
   * **Root Directory**: `frontend`
   * **Framework Preset**: `Vite`
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
4. Add **Environment Variable**:
   * `VITE_API_BASE_URL`: `https://termjobs-backend.onrender.com`
5. Click **Deploy**.
6. Vercel will give you a global live URL: `https://termjobs.vercel.app`.

---

## ⚡ Pro-Tip: Preventing Free Backend "Cold Starts"
Render's free tier sleeps after 15 minutes of inactivity (takes ~30s on the first request to wake up).

**Free Solution**:
1. Go to [cron-job.org](https://cron-job.org/) (100% free web pinger).
2. Create a cron job that sends a `GET` request to `https://termjobs-backend.onrender.com/health` every **10 minutes**.
3. Your backend stays **awake 24/7 with 0ms delay**!

---

## 📊 Summary Cost Table

| Layer | Service | Monthly Cost |
| :--- | :--- | :--- |
| **Frontend (React)** | Vercel / Cloudflare Pages | **$0.00** (Free Forever) |
| **Backend (FastAPI)** | Render.com Web Service | **$0.00** (Free Tier) |
| **Database (MongoDB)** | MongoDB Atlas M0 | **$0.00** (Free Tier) |
| **AI LLM Inference** | Groq Cloud API | **$0.00** (14,400 Free Reqs/Day) |
| **SSL Certificates** | Automatic HTTPS | **$0.00** (Included Everywhere) |
| **Total** | | **$0.00 / month** |
