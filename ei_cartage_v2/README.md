# EI Cartage — Digital Manifest System

A fully featured digital manifest system for EI Cartage / Expeditors trucking program. Drivers submit daily manifests from tablets, managers review and approve, and weekly summaries with cost analytics are generated automatically.

---

## Features

- **Driver sign-in** — name + driver # authentication
- **Daily manifest entry** — deliveries and pickups with full stop detail, multi-drop support, optional notes
- **Auto-save draft** — drivers can close the app mid-day and pick up where they left off
- **Manager dashboard** — week-by-week navigation, collapsible driver groups, mark reviewed
- **Weekly summary** — mirrors spreadsheet format with all cost/weight stats, print to PDF, CSV download
- **Customer view** — read-only access code login showing shipment and cost stats only
- **Driver & manager roster** — add/edit/remove drivers, configurable truck type rates and drop locations
- **Shared database** — all devices sync in real time via Supabase

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Single-page HTML/CSS/JS (no framework) |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Hosting | Railway |

---

## Project Structure

```
ei_cartage_app/
├── server.js                  # Express server + Supabase API proxy
├── package.json               # Dependencies and start script
├── supabase_schema.sql        # Database schema — run this in Supabase first
├── .env.example               # Environment variable template
├── .gitignore
├── README.md
└── public/
    ├── index.html             # App shell — links CSS and JS files
    ├── css/
    │   └── styles.css         # All application styles
    └── js/
        ├── config.js          # Global state and constants
        ├── api.js             # API/storage layer (Supabase proxy)
        ├── auth.js            # Login, logout, session management
        ├── draft.js           # Auto-save draft system
        ├── form.js            # Manifest entry form and submission
        ├── manager.js         # Manager dashboard and week navigation
        ├── summary.js         # Weekly summary, print, CSV export
        ├── drivers.js         # Driver/manager roster and settings
        └── app.js             # App initialization (loads last)
```

---

## Setup & Deployment

### 1. Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the Supabase dashboard, go to **SQL Editor**
3. Paste and run the contents of `supabase_schema.sql`
4. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (under Project API keys) → `SUPABASE_SERVICE_KEY`

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

⚠️ Never commit `.env` to git — it's in `.gitignore`

### 3. Local Development

```bash
npm install
npm start
# App runs at http://localhost:3000
```

### 4. Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) and create a **New Project → Deploy from GitHub repo**
3. Select your repository
4. Go to your service's **Variables** tab and add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
5. Railway auto-detects Node.js and runs `npm start`
6. Your app will be live at the Railway-provided URL

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only, never sent to browser) |
| `PORT` | Port to run on (Railway sets this automatically) |

---

## API Routes

The Express server acts as a secure proxy — Supabase keys never reach the browser.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/store` | Load all app data (manifests, roster, settings) |
| `PUT` | `/api/store/:key` | Save/update a value by key |
| `DELETE` | `/api/store/:key` | Delete a key |

### Data Keys

| Key | Contents |
|-----|----------|
| `ei_manifests` | All submitted driver manifests (JSON array) |
| `ei_driver_roster` | Driver names, units, and rates |
| `ei_truck_rates` | TT and ST hourly rates |
| `ei_drop_locations` | Expeditors drop location addresses |
| `ei_manager_emp` | Manager employee # (login password) |
| `ei_manager_roster` | Manager names and badge numbers |

> **Note:** Draft data (`ei_manifest_draft`) stays in `localStorage` on the device — it's personal to each driver and doesn't need to sync.

---

## Logins & Access

### Driver Login
- Select name from dropdown
- Enter Driver # (permanent ID)

### Manager Login
- Tap **"Open Dashboard"** on the login screen
- Enter employee # (default: **1234** — change in Driver Management)

### Customer View (Read-Only)
- Tap **"Customer View"** on the login screen
- Enter access code: **`EXP2025`**
- Shows shipment stats and weekly cost summary only — no editing, no driver info

---

## Driver Rates

Rates are set by truck type, not per driver:

| Type | Default Rate |
|------|-------------|
| Tractor Trailer (TT) | $92/hr |
| Straight Truck (ST) | $87/hr |

Rates can be updated in **Manager Dashboard → Manage Drivers → Truck Type Rates**.

---

## For the Developer

### Adding Real Authentication
The current login system uses simple employee # / access code checks. To add proper auth:
- Replace `doLogin()`, `openMgrLogin()`, `doCustomerLogin()` with Supabase Auth calls
- Use Supabase Row Level Security (RLS) to restrict data access by role

### Swapping to Real-Time Updates
To make the dashboard update live as drivers submit:
- Replace `GET /api/store` polling with a Supabase Realtime subscription on the `kn_store` table
- Call `refreshMgr()` on the `ei_manifests` key change event

### Offline Support
The app currently shows a loading screen and waits for the API on startup. For full offline-first support, add a Service Worker that caches the app shell and queues API writes.

---

## License

Private — EI Cartage / Expeditors internal use only.
