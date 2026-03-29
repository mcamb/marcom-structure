const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

app.use(express.json());

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function groupBlocksByType(blocks) {
  const grouped = {};
  for (const b of blocks || []) {
    const t = (b.type || '').trim() || '_empty';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(b.value);
  }
  return grouped;
}

/** Eine Zeile pro Block: "typ: wert" (Doppelpunkt nur beim ersten Vorkommen). */
function parseBlocksText(text) {
  if (!text || typeof text !== 'string') return [];
  const out = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const type = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (type && value) out.push({ type, value });
  }
  return out;
}

let client;

async function getDb() {
  if (!uri) throw new Error('MONGODB_URI missing');
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db('marcom');
}

app.get('/api/db-health', async (req, res) => {
  let c;
  try {
    if (!uri) return res.status(500).json({ ok: false, error: 'MONGODB_URI missing' });
    c = new MongoClient(uri);
    await c.connect();
    await c.db('admin').command({ ping: 1 });
    res.json({ ok: true, mongo: 'connected' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  } finally {
    if (c) await c.close().catch(() => {});
  }
});

app.get('/api/campaigns', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .collection('campaigns')
      .find({}, { projection: { client: 1, name: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      rows.map((r) => ({
        id: r._id.toString(),
        client: r.client,
        name: r.name,
        createdAt: r.createdAt,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/campaigns', async (req, res) => {
  try {
    const { client: kunde, name, blocks } = req.body || {};
    if (!kunde || !name) {
      return res.status(400).json({ error: 'client und name sind Pflicht' });
    }
    const normalizedBlocks = Array.isArray(blocks)
      ? blocks
          .filter((b) => b && typeof b.type === 'string' && typeof b.value === 'string')
          .map((b) => ({ type: b.type.trim(), value: b.value.trim() }))
          .filter((b) => b.type && b.value)
      : [];
    const doc = {
      client: String(kunde).trim(),
      name: String(name).trim(),
      blocks: normalizedBlocks,
      createdAt: new Date(),
    };
    const db = await getDb();
    const r = await db.collection('campaigns').insertOne(doc);
    res.status(201).json({
      id: r.insertedId.toString(),
      client: doc.client,
      name: doc.name,
      blocks: doc.blocks,
      blocksByType: groupBlocksByType(doc.blocks),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Ungültige id' });
    const db = await getDb();
    const c = await db.collection('campaigns').findOne({ _id: new ObjectId(id) });
    if (!c) return res.status(404).json({ error: 'Campaign nicht gefunden' });
    res.json({
      id: c._id.toString(),
      client: c.client,
      name: c.name,
      blocks: c.blocks || [],
      blocksByType: groupBlocksByType(c.blocks),
      createdAt: c.createdAt,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/campaigns/:id/blocks', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Ungültige id' });
    const { type, value } = req.body || {};
    if (!type || !value || typeof type !== 'string' || typeof value !== 'string') {
      return res.status(400).json({ error: 'type und value (Strings) sind Pflicht' });
    }
    const block = { type: type.trim(), value: value.trim() };
    if (!block.type || !block.value) {
      return res.status(400).json({ error: 'type und value dürfen nicht leer sein' });
    }
    const db = await getDb();
    const r = await db.collection('campaigns').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $push: { blocks: block }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!r.value) return res.status(404).json({ error: 'Campaign nicht gefunden' });
    res.status(201).json({
      id: r.value._id.toString(),
      blocks: r.value.blocks || [],
      blocksByType: groupBlocksByType(r.value.blocks),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/** Legt die Beispiel-Kampagne an, falls noch keine mit gleichem Kunden+Name existiert. */
app.post('/api/seed-demo', async (req, res) => {
  try {
    const db = await getDb();
    const col = db.collection('campaigns');
    const clientName = 'BMW';
    const campaignName = 'iX Launch Frühjahr 2026';
    let doc = await col.findOne({ client: clientName, name: campaignName });
    if (!doc) {
      const blocks = [
        { type: 'market', value: 'DE' },
        { type: 'market', value: 'FR' },
        { type: 'channel', value: 'YouTube' },
        { type: 'channel', value: 'Meta' },
        { type: 'format', value: '16:9 Video' },
        { type: 'headline', value: 'H1' },
      ];
      const insert = {
        client: clientName,
        name: campaignName,
        blocks,
        createdAt: new Date(),
      };
      const ins = await col.insertOne(insert);
      doc = { ...insert, _id: ins.insertedId };
    }
    res.status(201).json({
      id: doc._id.toString(),
      client: doc.client,
      name: doc.name,
      blocks: doc.blocks || [],
      blocksByType: groupBlocksByType(doc.blocks),
      seeded: true,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/c/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      res.status(400).send('Ungültige id');
      return;
    }
    const db = await getDb();
    const c = await db.collection('campaigns').findOne({ _id: new ObjectId(id) });
    if (!c) {
      res.status(404).send('Campaign nicht gefunden');
      return;
    }
    const byType = groupBlocksByType(c.blocks);
    const types = Object.keys(byType).sort();
    let body = '';
    for (const t of types) {
      body += `<section style="margin-bottom:1.25rem"><h2 style="font-size:1rem;margin:0 0 0.5rem">${escapeHtml(
        t
      )}</h2><ul style="margin:0;padding-left:1.25rem">`;
      for (const v of byType[t]) {
        body += `<li>${escapeHtml(v)}</li>`;
      }
      body += '</ul></section>';
    }
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(
      c.name
    )}</title><style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;color:#111}a{color:#06c}</style></head><body><p><a href="/">← Alle Kampagnen</a></p><h1 style="font-size:1.35rem">${escapeHtml(
      c.client
    )}: ${escapeHtml(c.name)}</h1>${body || '<p>Keine Blocks.</p>'}</body></html>`;
    res.type('html').send(html);
  } catch (e) {
    res.status(500).send(escapeHtml(String(e.message || e)));
  }
});

app.get('/neu', (req, res) => {
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Neue Kampagne</title><style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;color:#111}a{color:#06c}label{display:block;margin-top:0.75rem;font-weight:600}input,textarea{width:100%;max-width:100%;box-sizing:border-box;margin-top:0.25rem;padding:0.4rem}textarea{min-height:9rem;font-family:ui-monospace,monospace;font-size:0.9rem}button{font:inherit;cursor:pointer;margin-top:1rem;padding:0.45rem 0.75rem}.hint{font-size:0.85rem;color:#444;margin-top:0.25rem}</style></head><body><p><a href="/">← Zur Übersicht</a></p><h1 style="font-size:1.35rem">Neue Kampagne</h1><form method="post" action="/neu"><label for="client">Kunde</label><input id="client" name="client" required placeholder="z. B. BMW" /><label for="name">Kampagnenname</label><input id="name" name="name" required placeholder="z. B. Sommer 2026" /><label for="blocks">Blocks <span style="font-weight:normal">(optional)</span></label><p class="hint">Eine Zeile pro Baustein: <code>typ: wert</code></p><textarea id="blocks" name="blocks" placeholder="market: DE&#10;channel: YouTube&#10;format: 16:9 Video"></textarea><div><button type="submit">Kampagne anlegen</button></div></form></body></html>`;
  res.type('html').send(html);
});

app.post('/neu', express.urlencoded({ extended: true, limit: '512kb' }), async (req, res) => {
  try {
    const kunde = (req.body && req.body.client && String(req.body.client).trim()) || '';
    const name = (req.body && req.body.name && String(req.body.name).trim()) || '';
    const blocksRaw = req.body && req.body.blocks;
    if (!kunde || !name) {
      res.status(400).send('Kunde und Kampagnenname sind Pflicht.');
      return;
    }
    const blocks = parseBlocksText(typeof blocksRaw === 'string' ? blocksRaw : '');
    const doc = {
      client: kunde,
      name,
      blocks,
      createdAt: new Date(),
    };
    const db = await getDb();
    const r = await db.collection('campaigns').insertOne(doc);
    res.redirect(303, `/c/${r.insertedId.toString()}`);
  } catch (e) {
    res.status(500).send(escapeHtml(String(e.message || e)));
  }
});

app.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .collection('campaigns')
      .find({}, { projection: { client: 1, name: 1 } })
      .sort({ createdAt: -1 })
      .toArray();
    let list = '';
    for (const r of rows) {
      const id = r._id.toString();
      list += `<li><a href="/c/${id}">${escapeHtml(r.client)}: ${escapeHtml(r.name)}</a></li>`;
    }
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Kampagnen</title><style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;color:#111}a{color:#06c}button{font:inherit;cursor:pointer}</style></head><body><h1 style="font-size:1.35rem">Kampagnen</h1><p><a href="/neu">Neue Kampagne anlegen</a></p><p>API: <code>/api/campaigns</code>, Demo: <code>POST /api/seed-demo</code></p><form method="post" action="/seed-demo" style="margin-bottom:1rem"><button type="submit">Beispiel-Kampagne anlegen (BMW)</button></form><ul>${list || '<li>Noch keine Kampagne.</li>'}</ul></body></html>`;
    res.type('html').send(html);
  } catch (e) {
    res.status(500).send(escapeHtml(String(e.message || e)));
  }
});

app.post('/seed-demo', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const db = await getDb();
    const col = db.collection('campaigns');
    const clientName = 'BMW';
    const campaignName = 'iX Launch Frühjahr 2026';
    let doc = await col.findOne({ client: clientName, name: campaignName });
    if (!doc) {
      const blocks = [
        { type: 'market', value: 'DE' },
        { type: 'market', value: 'FR' },
        { type: 'channel', value: 'YouTube' },
        { type: 'channel', value: 'Meta' },
        { type: 'format', value: '16:9 Video' },
        { type: 'headline', value: 'H1' },
      ];
      const ins = await col.insertOne({
        client: clientName,
        name: campaignName,
        blocks,
        createdAt: new Date(),
      });
      doc = { _id: ins.insertedId, client: clientName, name: campaignName, blocks };
    }
    res.redirect(303, `/c/${doc._id.toString()}`);
  } catch (e) {
    res.status(500).send(escapeHtml(String(e.message || e)));
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log('Listening on ' + port);
});
