const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: function(res, path) {
    if(path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('WARNING: SUPABASE_URL and/or SUPABASE_SERVICE_KEY not set.');
  console.warn('API routes will return errors until env vars are configured.');
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
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  let parsed = null;
  if (text) {
    if (contentType.includes('application/json')) {
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        parsed = { raw: text, parseError: e.message };
      }
    } else {
      parsed = { raw: text };
    }
  }
  return { status: res.status, body: parsed };
}

// Keys that must never be exposed to the client via bulk GET /api/store.
// The client needs to know "is this PIN/code correct?" not the PIN/code itself.
const SECRET_KEYS = new Set(['ei_manager_emp', 'ei_customer_code']);

// Keys the client is allowed to write via PUT /api/store/:key.
// Anything not on this list is rejected — prevents an arbitrary visitor
// from creating/overwriting unrelated rows in kn_store.
const WRITABLE_KEYS = new Set([
  'ei_manifests',
  'ei_driver_roster',
  'ei_truck_rates',
  'ei_manager_emp',
  'ei_customer_code',
  'ei_drop_locations',
  'ei_jfiles',
  'ei_tolls',
  'ei_trailers',
  'ei_trailer_rate',
  'ei_change_log',
  'ei_manager_roster',
  'ei_roster_version',
]);
function isWritableKey(key) {
  return WRITABLE_KEYS.has(key) || /^manifest:/.test(key) || /^jfile:/.test(key);
}

// GET /api/store — load all keys (secret keys withheld — see SECRET_KEYS)
app.get('/api/store', async (req, res) => {
  try {
    const { status, body } = await sb('GET', 'kn_store?select=key,value');
    if (status >= 400) return res.status(status).json({ error: body });
    // Return as flat object { key: value }, skipping secrets
    const data = {};
    (body || []).forEach(row => {
      if (SECRET_KEYS.has(row.key)) return;
      data[row.key] = row.value;
    });
    res.json(data);
  } catch (e) {
    console.error('GET /api/store error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/verify — check a manager PIN or customer access code server-side.
// The client never receives the actual secret value, only true/false.
app.post('/api/verify', async (req, res) => {
  try {
    const { kind, value } = req.body || {};
    const keyMap = { manager: 'ei_manager_emp', customer: 'ei_customer_code' };
    const key = keyMap[kind];
    if (!key) return res.status(400).json({ error: 'Invalid kind' });
    const { status, body } = await sb('GET', `kn_store?key=eq.${encodeURIComponent(key)}&select=value`);
    if (status >= 400) return res.status(status).json({ error: body });
    const defaults = { manager: '1234', customer: 'EXP2025' };
    const stored = (body && body[0] && body[0].value) || defaults[kind];
    const submitted = typeof value === 'string' ? value.trim() : '';
    const ok = submitted.length > 0 &&
      submitted.toUpperCase() === String(stored).trim().toUpperCase();
    res.json({ ok });
  } catch (e) {
    console.error('POST /api/verify error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Safety net added after the Sept 2026 data-loss incident: for the two
// array-shaped keys that hold the operational record (manifests, J-Files),
// refuse a write that would drop most of the existing records in one shot.
// The incident that erased ei_manifests from 257 records down to 1 was a
// client-side bug (a failed refresh got treated as "empty," so the merge
// wrote a near-empty array back over everything) — the client-side fix is
// in api.js, but a client bug should never *also* be able to erase most of
// a dataset in a single write without the server pushing back. Legitimate
// single-record deletes/edits are always far under this threshold; a
// client that genuinely needs to shrink the dataset a lot can send the
// x-allow-shrink header to bypass this check.
const SHRINK_GUARDED_KEYS = new Set(['ei_manifests', 'ei_jfiles', 'ei_tolls', 'ei_trailers', 'ei_change_log']);

async function guardAgainstDataLoss(key, newValueStr, req) {
  if (!SHRINK_GUARDED_KEYS.has(key)) return null;
  if (req.get('x-allow-shrink') === 'true') return null;

  let newArr;
  try { newArr = JSON.parse(newValueStr); } catch (e) { return null; }
  if (!Array.isArray(newArr)) return null;

  const { status, body } = await sb('GET', `kn_store?key=eq.${encodeURIComponent(key)}&select=value`);
  if (status >= 400 || !body || !body[0]) return null; // nothing on record yet to compare against

  let oldArr;
  try { oldArr = JSON.parse(body[0].value); } catch (e) { return null; }
  if (!Array.isArray(oldArr)) return null;

  const dropped = oldArr.length - newArr.length;
  const threshold = Math.max(3, Math.ceil(oldArr.length * 0.05));
  if (dropped > threshold) {
    return `Refusing write to "${key}": this write would drop ${dropped} of ${oldArr.length} ` +
      `existing records (${oldArr.length} -> ${newArr.length}). If this is really intentional, ` +
      `retry the request with header "x-allow-shrink: true".`;
  }
  return null;
}

// PUT /api/store/:key — upsert a value
app.put('/api/store/:key', async (req, res) => {
  try {
    const key = req.params.key;
    if (!isWritableKey(key)) {
      return res.status(403).json({ error: 'Key not writable' });
    }
    const value = typeof req.body.value === 'string'
      ? req.body.value
      : JSON.stringify(req.body.value);

    const guardError = await guardAgainstDataLoss(key, value, req);
    if (guardError) {
      console.error('PUT /api/store blocked by data-loss guard:', guardError);
      return res.status(409).json({ error: guardError });
    }

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
    if (!isWritableKey(key)) {
      return res.status(403).json({ error: 'Key not deletable' });
    }
    const { status, body } = await sb('DELETE', `kn_store?key=eq.${encodeURIComponent(key)}`);
    if (status >= 400) return res.status(status).json({ error: body });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/store error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Fallback — serve index.html for any unmatched route, except bad /api paths
// (those should 404, not silently return HTML that then fails client-side JSON parsing)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`EI Cartage server running on port ${PORT}`));
