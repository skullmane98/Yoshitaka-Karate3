# Hybrid Deployment Guide
**Frontend: Hostinger Business** + **Backend: Railway** + **Database: MongoDB Atlas**

This is the cheapest, easiest way to put this app live without upgrading your Hostinger plan.

Total time: ~30–45 minutes the first time.
Total cost: **$0** for the first ~500 MB of data and modest traffic.

---

## Architecture overview

```
  Visitor's browser
        │
        ▼
  https://mediumblue-mouse-647622.hostingersite.com   ← Hostinger Business (static React)
        │
        │  fetch("https://yoshitaka-api.up.railway.app/api/auth/login")
        ▼
  Railway (FastAPI backend)                            ← runs Python 24/7
        │
        │  motor / pymongo
        ▼
  MongoDB Atlas (free 512 MB cluster)                  ← stores users, codes, payments
```

---

## Phase 1 — Create the database (MongoDB Atlas)

1. Go to https://www.mongodb.com/cloud/atlas/register and sign up (free, no card required).
2. After signup, you'll see "Deploy your database" — pick **M0 Free Cluster**.
   - Provider: **AWS**
   - Region: pick the one closest to where your users live (e.g., `us-east-1`)
   - Cluster name: `Cluster0` (default is fine)
   - Click **Create Deployment**.
3. **Database User** screen — create a user:
   - Username: `yoshitaka`
   - Password: click **Autogenerate Secure Password** and **save it somewhere safe** (you'll need it shortly).
   - Click **Create Database User**.
4. **Network Access** screen — add an IP:
   - Click **Add IP Address** → **Allow Access from Anywhere** → confirms `0.0.0.0/0`.
   - (Reason: Railway's IPs change; we'll lock down later if needed.)
   - Click **Finish and Close**.
5. Click **Go to Overview**, then click **Connect** on your cluster:
   - Choose **Drivers**.
   - Driver: **Python**, Version: **3.12 or later**.
   - Copy the connection string. It looks like:
     ```
     mongodb+srv://yoshitaka:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
     ```
   - **Replace `<password>`** with the password you saved in step 3 (URL-encode any special characters: `@` → `%40`, `:` → `%3A`, `/` → `%2F`, etc.).
6. Save the final connection string somewhere safe — you'll paste it into Railway in Phase 2.

Done. Your database is live. ✅

---

## Phase 2 — Deploy the backend (Railway)

1. Go to https://railway.com and sign up with GitHub (recommended) or email.
   - Free tier gives you **$5 of usage per month** — plenty for this app's traffic.
2. **Get the code into a GitHub repo** if it isn't already. From the Emergent UI, use the **"Save to GitHub"** feature in the chat input area to push `/app` to a new GitHub repo. (Don't try to `git push` from the chat — Emergent handles this for you via that button.)
3. In Railway, click **New Project** → **Deploy from GitHub repo** → pick your repo.
4. Railway will detect the project. Configure it as follows:
   - Click the deployed service → **Settings**.
   - **Root Directory**: `/backend` (very important — points Railway at the FastAPI folder)
   - **Build Command**: leave empty (Nixpacks auto-detects from `requirements.txt` + `runtime.txt`)
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT` (already in `Procfile`)
5. Go to the **Variables** tab and add these (copy from `/app/backend/.env.example`):

   | Variable | Value |
   |---|---|
   | `MONGO_URL` | The full Atlas connection string from Phase 1, step 6 |
   | `DB_NAME` | `yoshitaka_karatedo` |
   | `CORS_ORIGINS` | `https://mediumblue-mouse-647622.hostingersite.com` (your Hostinger URL, **no trailing slash**) |
   | `JWT_SECRET` | A long random hex string. Generate at https://www.uuidgenerator.net/ or run `openssl rand -hex 32` locally |
   | `SUPER_ADMIN_EMAIL` | `superadmin@yoshitaka.com` (or your real email) |
   | `SUPER_ADMIN_PASSWORD` | A new secure password — **change this from the dev default!** |
   | `SUPER_ADMIN_NAME` | `Super Administrator` |

   The SMTP_* variables can be left blank for now.

6. Click **Deploy**. Railway will install dependencies (~3 minutes) and start the server.
7. Once it says "Active", go to the service's **Settings** → **Networking** → **Generate Domain**.
   - Railway gives you a URL like `https://yoshitaka-api-production-1234.up.railway.app`.
8. **Test it** — open `https://YOUR-RAILWAY-URL.up.railway.app/api/` in your browser. You should see:
   ```json
   {"status":"ok","service":"yoshitaka-karatedo-cms"}
   ```
9. Watch the deployment logs for: `Seeded super admin: superadmin@yoshitaka.com` (or similar). That confirms the database was seeded.

Done. Your backend is live. ✅

---

## Phase 3 — Rebuild the frontend with the new backend URL

1. On your local machine (or in the Emergent dev environment), edit `/app/frontend/.env`:

   ```
   REACT_APP_BACKEND_URL=https://YOUR-RAILWAY-URL.up.railway.app
   ```

   (Replace with the URL from Phase 2 step 7, **no trailing slash**, no `/api` at the end — the frontend code adds `/api` itself.)

2. Build the production bundle:
   ```bash
   cd /app/frontend
   yarn build
   ```
   This creates `/app/frontend/build/` with static HTML/JS/CSS.

3. **Upload to Hostinger:**
   - Log into Hostinger → **hPanel** → **Websites** → your `mediumblue-mouse-647622.hostingersite.com` site → **File Manager**.
   - Navigate to `public_html/`.
   - Delete everything currently in `public_html/`.
   - Upload **the contents of** `/app/frontend/build/` (not the folder itself — the files inside it: `index.html`, `static/`, etc.).
4. **Add this `.htaccess` file** in `public_html/` so React Router works (single-page app routing):

   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

5. Visit `https://mediumblue-mouse-647622.hostingersite.com/login`, enter the super-admin credentials you set in Railway, click **Enter Dojo** → you should be in the Super Admin dashboard.

Done. Your full app is live. ✅

---

## Phase 4 — Connect a custom domain (optional)

If you bought a domain on Hostinger (e.g., `yoshitakakaratedo.com`):

1. **Hostinger hPanel** → **Domains** → **Manage** your domain → **Connect to Website** → pick your hostingersite.com site. Hostinger handles DNS automatically. Within 15–60 minutes the site is reachable at your domain.
2. **Update CORS in Railway** — go back to the Railway **Variables** tab and update `CORS_ORIGINS` to include both the hostingersite URL **and** your custom domain:
   ```
   CORS_ORIGINS=https://mediumblue-mouse-647622.hostingersite.com,https://yoshitakakaratedo.com,https://www.yoshitakakaratedo.com
   ```
   Railway will redeploy automatically (~30 seconds).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login still 404s | Frontend was not rebuilt with new `REACT_APP_BACKEND_URL`, or the URL is wrong/has a trailing slash | Re-do Phase 3 carefully. Open browser DevTools → Network tab → confirm the failing request URL |
| Login returns 500 | MongoDB connection bad — wrong password, IP not whitelisted, or special chars not URL-encoded in connection string | Check Railway logs; re-paste the MONGO_URL with proper URL-encoding |
| Login returns 401 with correct password | The DB was seeded with a different password than you typed | Reset by deleting the user from Atlas (Collections → users) and re-deploying — the seed runs again on next start |
| Login returns CORS error | `CORS_ORIGINS` doesn't include your front-end URL exactly | Update it in Railway Variables and wait for redeploy |
| Looks blank / shows raw HTML on direct route URLs (e.g., `/dashboard`) | `.htaccess` missing on Hostinger | Add the rewrite rules from Phase 3 step 4 |
| Backend cold-starts slowly on first request | Free Railway containers sleep when idle | Upgrade to Hobby plan (~$5/mo) for always-on |

---

## Files added to your codebase for this deployment

- `backend/Procfile` — tells Railway how to start the app
- `backend/runtime.txt` — pins Python 3.11
- `backend/railway.json` — Railway build config + healthcheck
- `backend/.env.example` — variable reference (do NOT commit real values)
- `backend/server.py` — added `/api/` health endpoint and `hostingersite.com` CORS pattern

You're good to go. If you hit a snag at any phase, paste the error and which phase you're on, and I'll diagnose.
