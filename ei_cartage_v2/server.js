const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

// Helper: call Supabase REST API
async function sb(method, path, body) {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// GET /api/store — load all keys
app.get('/api/store', async (req, res) => {
  try {
    const { status, body } = await sb('GET', 'kn_store?select=key,value');
    if (status >= 400) return res.status(status).json({ error: body });
    // Return as flat object { key: value }
    const data = {};
    (body || []).forEach(row => { data[row.key] = row.value; });
    res.json(data);
  } catch (e) {
    console.error('GET /api/store error:', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/store/:key — upsert a value
app.put('/api/store/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const value = typeof req.body.value === 'string'
      ? req.body.value
      : JSON.stringify(req.body.value);
    const { status, body } = await sb('POST', 'kn_store', {
      key,
      value,
      updated_at: new Date().toISOString(),
    });
    if (status >= 400) return res.status(status).json({ error: body });
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/store error:', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/store/:key — delete a key
app.delete('/api/store/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const { status, body } = await sb('DELETE', `kn_store?key=eq.${encodeURIComponent(key)}`);
    if (status >= 400) return res.status(status).json({ error: body });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/store error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Fallback — serve index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`EI Cartage server running on port ${PORT}`));
