# K&N House Driver Manifest 

A full-stack web application for K&N's dedicated fleet air freight operation. Drivers submit daily manifests from tablets; managers review, edit, and pull weekly summaries from a dashboard.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JavaScript (single file, no framework) |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Hosting | Railway |

---

## Features

- Driver sign-in with name and driver number
- Daily manifest entry with auto-save drafts (per device)
- MAWB auto-lookup from IATA airline prefix database (182 airlines)
- Flat-rate cargo type pricing (AKE, DPE, PGA, etc.)
- Automatic R&M charge calculation ($0.035/lb, $20 min, $395 max)
- Weight conversion (KG ↔ LBS)
- Sub-MAWB entries for multiple stops at same airline
- Added fees per shipment
- Substitute driver tracking
- Manager dashboard with week navigation
- Edit, review, and delete manifests from dashboard
- Wait time flag system (A/L ≥ 3hrs, K&N gap ≥ 2hrs) with one-tap fee entry at $90/hr
- Weekly summary with per-driver and fleet totals
- Print-ready PDF summary (landscape, auto-fits to one page)
- Driver roster and unit rate management
- Real-time sync across all devices via Supabase

---

## Project Structure

```
kn-manifest/
├── server.js              # Express server — serves app + proxies Supabase
├── package.json
├── .env.example           # Environment variable template
├── .gitignore
├── supabase_schema.sql    # Run this in Supabase SQL Editor first
└── public/
    └── index.html         # The entire frontend application
```

---

## Setup

### 1. Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project (choose a region near Chicago)
3. Go to **SQL Editor** and run the contents of `supabase_schema.sql`
4. Go to **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://xyzxyz.supabase.co`)
   - **service_role** key (under "Project API keys" — use service_role, NOT anon)

### 2. Local Development

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/kn-manifest.git
cd kn-manifest

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and fill in your SUPABASE_URL and SUPABASE_SERVICE_KEY

# Run locally
npm run dev
# Open http://localhost:3000
```

### 3. Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) and sign in with GitHub
3. Click **New Project → Deploy from GitHub repo** → select `kn-manifest`
4. Railway will detect Node.js automatically
5. Go to your service → **Variables** and add:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```
6. Click **Generate Domain** to get your public URL
7. Share the URL with all drivers and managers

Railway will automatically redeploy every time you push to GitHub.

---

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key (server-side only, never sent to browser) |
| `PORT` | Set automatically by Railway — do not override |

---

## Database Schema

One table: `kn_store` — a simple key/value store.

| Column | Type | Description |
|---|---|---|
| `key` | text (PK) | Data key (e.g. `kn_manifests`, `kn_drivers`) |
| `value` | text | JSON-stringified value |
| `updated_at` | timestamptz | Auto-updated timestamp |

**Keys used by the app:**

| Key | Contents |
|---|---|
| `kn_manifests` | Array of all submitted manifests |
| `kn_drivers` | Driver roster |
| `kn_managers` | Manager credentials |
| `kn_unit_rates` | Hourly rates by unit type |

Drafts (`kn_draft_*`) are stored in the browser's localStorage on the driver's device and are intentionally not synced to Supabase.

---

## How Data Flows

1. On page load, the app calls `GET /api/store` to fetch all data into an in-memory cache
2. Every save operation updates the cache immediately (so the UI is always fast) and sends a `PUT /api/store/:key` to the server in the background
3. The server uses the **service_role** key to upsert the value in Supabase
4. The Supabase **anon key is never sent to the browser** — all database access goes through the Express server

---

## Future Improvements

- [ ] Replace badge number manager login with Supabase Auth (email/password)
- [ ] Real-time push updates when manager edits a manifest (Supabase Realtime)
- [ ] Sync drafts across devices (move `kn_draft_*` to Supabase)
- [ ] Cargo TYPE dropdown with price associations
- [ ] Export to Excel

---

## Default Credentials

> **Change these before sharing with anyone.**

Manager badge number: `1234`  
Update via the Manager Dashboard → Drivers screen → Manager Access section.
