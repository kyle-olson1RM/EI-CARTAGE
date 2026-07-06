const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Supabase config (set these as Railway environment variables) ──────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key — server only, never sent to browser

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
}

// ── Supabase REST helper ──────────────────────────────────────────────────────
async function supabase(method, path, body) {
  const fetch = (await import('node-fetch')).default;
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation'
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ── API routes ────────────────────────────────────────────────────────────────

// GET /api/store — fetch all shared data at once (called on app startup)
app.get('/api/store', async (req, res) => {
  try {
    const rows = await supabase('GET', 'kn_store?select=key,value&order=key');
    const result = {};
    (rows || []).forEach(row => {
      try { result[row.key] = JSON.parse(row.value); } catch(e) { result[row.key] = row.value; }
    });
    res.json({ ok: true, data: result });
  } catch(e) {
    console.error('GET /api/store error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PUT /api/store/:key — upsert a single key
app.put('/api/store/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ ok: false, error: 'Missing value' });
  try {
    await supabase('POST', 'kn_store', {
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      updated_at: new Date().toISOString()
    });
    res.json({ ok: true });
  } catch(e) {
    console.error(`PUT /api/store/${key} error:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// DELETE /api/store/:key — delete a key (used for draft cleanup etc.)
app.delete('/api/store/:key', async (req, res) => {
  const { key } = req.params;
  try {
    await supabase('DELETE', `kn_store?key=eq.${encodeURIComponent(key)}`);
    res.json({ ok: true });
  } catch(e) {
    console.error(`DELETE /api/store/${key} error:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`K&N Manifest running on port ${PORT}`));
