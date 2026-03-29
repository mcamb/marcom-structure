/**
 * MVP: Master-Taxonomie, Kampagnen-Zuordnungen, Allokationen, View-Profile.
 * Kern-Spine: brands → companies → campaigns
 */
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;
const DB_NAME = 'marcom';

app.use(express.urlencoded({ extended: true, limit: '512kb' }));

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

let mongoClient;

async function getDb() {
  if (!uri) throw new Error('MONGODB_URI missing');
  if (!mongoClient) {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
  }
  return mongoClient.db(DB_NAME);
}

const CSS = `
body{font-family:system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:1rem 1.25rem;color:#1a1a1a}
nav{margin-bottom:1.25rem;padding-bottom:0.75rem;border-bottom:1px solid #ddd}
nav a{margin-right:1rem;color:#06c}
h1{font-size:1.35rem}
h2{font-size:1.1rem;margin:1.5rem 0 0.5rem}
table{border-collapse:collapse;width:100%;font-size:0.9rem;margin:0.5rem 0}
th,td{border:1px solid #ccc;padding:0.4rem 0.5rem;text-align:left;vertical-align:top}
th{background:#f4f4f4}
form.inline{margin:0.25rem 0}
button,input,select,textarea{font:inherit}
button{cursor:pointer;padding:0.35rem 0.65rem}
.small{font-size:0.85rem;color:#444}
.breadcrumb{font-size:0.9rem;margin-bottom:0.75rem}
.breadcrumb a{color:#06c}
.panel{background:#fafafa;border:1px solid #e5e5e5;padding:1rem;margin:1rem 0;border-radius:6px}
.profile-pill{display:inline-block;margin:0.15rem 0.35rem 0 0}
.chip{display:inline-block;background:#e8f0fe;color:#1967d2;padding:0.2rem 0.55rem;border-radius:999px;font-size:0.8rem;margin:0.15rem 0.35rem 0 0}
`;

function layout(title, inner, breadcrumbHtml = '') {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(
    title
  )}</title><style>${CSS}</style></head><body><nav><a href="/">Marken</a><a href="/taxonomy">Taxonomie</a><a href="/profiles">Ansichten</a></nav>${breadcrumbHtml}<main>${inner}</main></body></html>`;
}

async function ensureIndexes(db) {
  await db.collection('brands').createIndex({ slug: 1 }, { unique: true });
  await db.collection('companies').createIndex({ brandId: 1 });
  await db.collection('campaigns').createIndex({ companyId: 1 });
  await db.collection('taxonomy_entries').createIndex({ type: 1, name: 1 }, { unique: true });
  await db.collection('taxonomy_entries').createIndex({ type: 1, active: 1 });
  await db.collection('taxonomy_links').createIndex(
    { relation: 1, fromEntryId: 1, toEntryId: 1 },
    { unique: true }
  );
  await db.collection('campaign_assignments').createIndex({ campaignId: 1, taxonomyType: 1 });
  await db.collection('campaign_assignments').createIndex(
    { campaignId: 1, taxonomyEntryId: 1 },
    { unique: true }
  );
  await db.collection('campaign_allocations').createIndex({ campaignId: 1, weekStart: 1 });
  await db.collection('view_profiles').createIndex({ key: 1 }, { unique: true });
}

async function seedMvpIfEmpty(db) {
  const tax = db.collection('taxonomy_entries');
  if ((await tax.countDocuments()) > 0) return;

  await db.collection('campaign_assignments').deleteMany({});
  await db.collection('campaign_allocations').deleteMany({});
  await db.collection('taxonomy_links').deleteMany({});
  await db.collection('taxonomy_entries').deleteMany({});
  await db.collection('campaigns').deleteMany({});
  await db.collection('companies').deleteMany({});
  await db.collection('brands').deleteMany({});
  await db.collection('view_profiles').deleteMany({});

  try {
    await db.collection('products').drop();
  } catch (_) {}

  const now = new Date();

  const brandsCol = db.collection('brands');
  const bmwId = (await brandsCol.insertOne({ name: 'BMW', slug: 'bmw', createdAt: now })).insertedId;
  const porscheId = (await brandsCol.insertOne({ name: 'Porsche', slug: 'porsche', createdAt: now })).insertedId;

  const companiesCol = db.collection('companies');
  const bmwDeId = (await companiesCol.insertOne({ brandId: bmwId, name: 'BMW Deutschland', createdAt: now })).insertedId;
  const porscheHqId = (await companiesCol.insertOne({ brandId: porscheId, name: 'Porsche HQ', createdAt: now })).insertedId;

  const campaignsCol = db.collection('campaigns');
  const camp1Id = (
    await campaignsCol.insertOne({
      companyId: bmwDeId,
      name: 'SUV Frühjahr 2026',
      code: 'BMW-SUV-26',
      createdAt: now,
    })
  ).insertedId;
  const camp2Id = (
    await campaignsCol.insertOne({
      companyId: porscheHqId,
      name: 'Sportscar Push',
      code: 'POR-SC-26',
      createdAt: now,
    })
  ).insertedId;

  const ins = async (type, name, label, extra = {}) =>
    (await tax.insertOne({ type, name, label, active: true, attributes: {}, ...extra })).insertedId;

  const goalAware = await ins('goal', 'awareness', 'Awareness');
  const goalSales = await ins('goal', 'sales', 'Sales');
  await ins('goal', 'drive_to_store', 'Drive-to-Store');

  const audPremium = await ins('audience', 'premium_40_59', '40–59 Premium Buyers');

  const mDE = await ins('market', 'de', 'Deutschland');
  const mFR = await ins('market', 'fr', 'Frankreich');

  const langDE = await ins('language', 'de', 'Deutsch');
  const langEN = await ins('language', 'en', 'Englisch');
  const langFR = await ins('language', 'fr', 'Französisch');

  const chTV = await ins('channel', 'tv', 'TV');
  const chYouTube = await ins('channel', 'youtube', 'YouTube');
  const chMeta = await ins('channel', 'meta', 'Meta');
  const chSearch = await ins('channel', 'paid_search', 'Paid Search');

  const fmtTvc = await ins('format', 'tvc_30s', 'TVC 30"', { attributes: { seconds: 30 } });
  const fmt169 = await ins('format', 'video_16_9', '16:9 Video');
  const fmt916 = await ins('format', 'vertical_9_16', '9:16 Vertical');
  const fmtMR = await ins('format', 'mrect_300_250', 'Medium Rectangle 300×250', {
    attributes: { width: 300, height: 250 },
  });

  const ftJpg = await ins('fileType', 'jpg', 'JPG');
  const ftMp4 = await ins('fileType', 'mp4', 'MP4');
  const ftHtml5 = await ins('fileType', 'html5', 'HTML5');

  const devMobile = await ins('device', 'mobile', 'Mobile');
  const devDesktop = await ins('device', 'desktop', 'Desktop');
  const devTablet = await ins('device', 'tablet', 'Tablet');

  const motif1 = await ins('motif', 'hero_suv', 'Hero SUV Bergstraße');
  const cta1 = await ins('cta', 'learn_more', 'Mehr erfahren');
  const cta2 = await ins('cta', 'book_test', 'Probefahrt buchen');

  await ins('status', 'draft', 'Entwurf');
  await ins('status', 'approved', 'Freigegeben');

  await ins('checkType', 'legal_disclaimer', 'Rechtlicher Disclaimer');
  await ins('checkType', 'safe_zone', 'Safe Zone / Einstand');

  const links = db.collection('taxonomy_links');
  const link = (rel, from, to, meta = {}) =>
    links.insertOne({ relation: rel, fromEntryId: from, toEntryId: to, metadata: meta, createdAt: now });

  await link('allows_format', chYouTube, fmt169);
  await link('allows_format', chYouTube, fmt916);
  await link('allows_format', chTV, fmtTvc);
  await link('allows_format', chMeta, fmtMR);
  await link('allows_format', chMeta, fmt169);

  await link('allows_file_type', fmtMR, ftJpg);
  await link('allows_file_type', fmt169, ftMp4);
  await link('allows_file_type', fmt916, ftMp4);
  await link('allows_file_type', fmtTvc, ftMp4);

  await link('allows_device', fmtMR, devMobile);
  await link('allows_device', fmtMR, devDesktop);
  await link('allows_device', fmt169, devMobile);
  await link('allows_device', fmt169, devDesktop);

  await link('allows_language', mDE, langDE);
  await link('allows_language', mFR, langFR);
  await link('allows_language', mFR, langEN);

  await link('suggests_cta', goalAware, cta1);
  await link('suggests_cta', goalSales, cta2);

  const assigns = db.collection('campaign_assignments');
  const addAssign = (cid, tid, eid, ctx) =>
    assigns.insertOne({
      campaignId: cid,
      taxonomyType: tid,
      taxonomyEntryId: eid,
      context: ctx || {},
      createdAt: now,
    });

  await addAssign(camp1Id, 'goal', goalAware, { priority: 1 });
  await addAssign(camp1Id, 'audience', audPremium, {});
  await addAssign(camp1Id, 'market', mDE, {});
  await addAssign(camp1Id, 'language', langDE, {});
  await addAssign(camp1Id, 'channel', chYouTube, { note: 'Fokus In-Feed' });
  await addAssign(camp1Id, 'channel', chMeta, {});
  await addAssign(camp1Id, 'format', fmt169, {});
  await addAssign(camp1Id, 'motif', motif1, {});
  await addAssign(camp1Id, 'cta', cta1, { variant: 'A' });
  await addAssign(camp1Id, 'status', (await tax.findOne({ type: 'status', name: 'draft' }))._id, {});

  await addAssign(camp2Id, 'goal', goalSales, {});
  await addAssign(camp2Id, 'channel', chSearch, {});
  await addAssign(camp2Id, 'format', fmtMR, {});

  const allocs = db.collection('campaign_allocations');
  await allocs.insertMany([
    {
      campaignId: camp1Id,
      weekStart: new Date('2026-04-06T00:00:00.000Z'),
      metric: 'planned_spend',
      amount: { value: 25000, currency: 'EUR' },
      scope: { channelEntryId: chYouTube, marketEntryId: mDE },
      createdAt: now,
    },
    {
      campaignId: camp1Id,
      weekStart: new Date('2026-04-13T00:00:00.000Z'),
      metric: 'planned_spend',
      amount: { value: 32000, currency: 'EUR' },
      scope: { channelEntryId: chMeta, marketEntryId: mDE },
      createdAt: now,
    },
    {
      campaignId: camp2Id,
      weekStart: new Date('2026-04-06T00:00:00.000Z'),
      metric: 'planned_spend',
      amount: { value: 12000, currency: 'EUR' },
      scope: { channelEntryId: chSearch },
      createdAt: now,
    },
  ]);

  const profiles = db.collection('view_profiles');
  await profiles.insertMany([
    {
      key: 'media',
      label: 'Media',
      visibleTaxonomyTypes: ['goal', 'audience', 'market', 'language', 'channel', 'format', 'status'],
      description: 'Schwerpunkt Planung & Buchung',
      createdAt: now,
    },
    {
      key: 'production',
      label: 'Production',
      visibleTaxonomyTypes: ['channel', 'format', 'fileType', 'device', 'motif', 'cta', 'status'],
      description: 'Schwerpunkt Assets & Specs',
      createdAt: now,
    },
    {
      key: 'regulatory',
      label: 'Regulatory (Demo)',
      visibleTaxonomyTypes: ['market', 'language', 'checkType', 'status'],
      description: 'Schwerpunft Prüfungen',
      createdAt: now,
    },
  ]);
}

async function loadProfile(db, key) {
  const p = await db.collection('view_profiles').findOne({ key: key || 'media' });
  if (p) return p;
  return await db.collection('view_profiles').findOne({}, { sort: { key: 1 } });
}

/** Optgroup select: all active entries grouped by type */
async function htmlSelectAllAssignments(db, allowedTypes) {
  const types = allowedTypes && allowedTypes.length ? allowedTypes : null;
  const filter = types ? { type: { $in: types }, active: true } : { active: true };
  const entries = await db.collection('taxonomy_entries').find(filter).sort({ type: 1, label: 1 }).toArray();
  let curType = null;
  let html =
    '<select name="taxonomyEntryId" required><option value="">— Eintrag wählen —</option>';
  for (const e of entries) {
    if (e.type !== curType) {
      if (curType !== null) html += '</optgroup>';
      html += `<optgroup label="${escapeHtml(e.type)}">`;
      curType = e.type;
    }
    html += `<option value="${e._id.toString()}">${escapeHtml(e.label)} · ${escapeHtml(e.name)}</option>`;
  }
  if (curType !== null) html += '</optgroup>';
  html += '</select>';
  return html;
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

app.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const brands = await db.collection('brands').find().sort({ name: 1 }).toArray();
    let rows = '';
    for (const b of brands) {
      rows += `<tr><td>${escapeHtml(b.name)}</td><td><code>${escapeHtml(b.slug)}</code></td><td><a href="/brand/${b._id}">Firmen</a></td></tr>`;
    }
    const inner = `<h1>Marken</h1><p class="small">Fester Kontext: Brand → Company → Campaign. Darunter Taxonomie & Zuordnungen.</p><table><thead><tr><th>Name</th><th>Slug</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="3">Keine Marken</td></tr>'}</tbody></table>`;
    res.type('html').send(layout('Marken', inner));
  } catch (e) {
    res.status(500).send(layout('Fehler', `<pre>${escapeHtml(String(e.message || e))}</pre>`));
  }
});

app.get('/brand/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).send('Ungültige ID');
    const db = await getDb();
    const brand = await db.collection('brands').findOne({ _id: new ObjectId(id) });
    if (!brand) return res.status(404).send('Marke nicht gefunden');
    const companies = await db
      .collection('companies')
      .find({ brandId: brand._id })
      .sort({ name: 1 })
      .toArray();
    let rows = '';
    for (const c of companies) {
      rows += `<tr><td>${escapeHtml(c.name)}</td><td><a href="/company/${c._id}">Kampagnen</a></td></tr>`;
    }
    const bc = `<p class="breadcrumb"><a href="/">Marken</a> / <strong>${escapeHtml(brand.name)}</strong></p>`;
    const inner = `<h1>${escapeHtml(brand.name)} – Firmen</h1><table><thead><tr><th>Firma</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="2">Keine Firmen</td></tr>'}</tbody></table>`;
    res.type('html').send(layout(brand.name, inner, bc));
  } catch (e) {
    res.status(500).send(String(e));
  }
});

app.get('/company/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).send('Ungültige ID');
    const db = await getDb();
    const company = await db.collection('companies').findOne({ _id: new ObjectId(id) });
    if (!company) return res.status(404).send('Firma nicht gefunden');
    const brand = await db.collection('brands').findOne({ _id: company.brandId });
    const campaigns = await db
      .collection('campaigns')
      .find({ companyId: company._id })
      .sort({ name: 1 })
      .toArray();
    let rows = '';
    for (const c of campaigns) {
      rows += `<tr><td>${escapeHtml(c.name)}</td><td><code>${escapeHtml(c.code || '')}</code></td><td><a href="/campaign/${c._id}">Öffnen</a></td></tr>`;
    }
    const bc = `<p class="breadcrumb"><a href="/">Marken</a> / <a href="/brand/${brand._id}">${escapeHtml(brand.name)}</a> / <strong>${escapeHtml(company.name)}</strong></p>`;
    const form = `<div class="panel"><h2>Neue Kampagne</h2><form method="post" action="/company/${company._id}/campaigns"><label>Name <input name="name" required style="min-width:16rem"/></label> <label>Code <input name="code" placeholder="optional"/></label> <button type="submit">Anlegen</button></form></div>`;
    const inner = `<h1>${escapeHtml(company.name)} – Kampagnen</h1>${form}<table><thead><tr><th>Name</th><th>Code</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="3">Keine Kampagnen</td></tr>'}</tbody></table>`;
    res.type('html').send(layout('Kampagnen', inner, bc));
  } catch (e) {
    res.status(500).send(String(e));
  }
});

app.post('/company/:id/campaigns', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).send('Ungültige ID');
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).send('Name fehlt');
    const code = (req.body.code || '').trim() || undefined;
    const db = await getDb();
    const r = await db.collection('campaigns').insertOne({
      companyId: new ObjectId(id),
      name,
      code,
      createdAt: new Date(),
    });
    res.redirect(303, `/campaign/${r.insertedId.toString()}`);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

app.get('/campaign/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const profileKey = (req.query.profile || 'media').toString();
    if (!ObjectId.isValid(id)) return res.status(400).send('Ungültige ID');
    const db = await getDb();
    const campaign = await db.collection('campaigns').findOne({ _id: new ObjectId(id) });
    if (!campaign) return res.status(404).send('Kampagne nicht gefunden');
    const company = await db.collection('companies').findOne({ _id: campaign.companyId });
    const brand = await db.collection('brands').findOne({ _id: company.brandId });
    const profile = await loadProfile(db, profileKey);

    const profiles = await db.collection('view_profiles').find().sort({ key: 1 }).toArray();
    let profileNav = '<p><strong>Ansicht:</strong> ';
    for (const p of profiles) {
      const active = p.key === profile.key ? ' <strong>' : ' ';
      const end = p.key === profile.key ? '</strong>' : '';
      profileNav += `${active}<a href="/campaign/${id}?profile=${encodeURIComponent(p.key)}">${escapeHtml(p.label)}</a>${end} · `;
    }
    profileNav = profileNav.replace(/ · $/, '</p>');
    profileNav += `<p class="small">${escapeHtml(profile.description || '')}</p>`;
    profileNav += `<p class="small">Sichtbare Taxonomie-Typen: ${profile.visibleTaxonomyTypes.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join(' ')}</p>`;

    const visible = profile.visibleTaxonomyTypes || [];

    const assigns = await db
      .collection('campaign_assignments')
      .find({ campaignId: campaign._id })
      .sort({ taxonomyType: 1 })
      .toArray();
    const entryIds = [...new Set(assigns.map((a) => a.taxonomyEntryId.toString()))];
    const idMap = {};
    if (entryIds.length) {
      const objs = entryIds.map((s) => new ObjectId(s));
      const ents = await db.collection('taxonomy_entries').find({ _id: { $in: objs } }).toArray();
      for (const e of ents) idMap[e._id.toString()] = e;
    }
    let assignRows = '';
    for (const a of assigns) {
      const e = idMap[a.taxonomyEntryId.toString()];
      const lbl = e ? e.label : '?';
      const ctx = a.context && Object.keys(a.context).length ? JSON.stringify(a.context) : '—';
      assignRows += `<tr><td><code>${escapeHtml(a.taxonomyType)}</code></td><td>${escapeHtml(lbl)}</td><td><code class="small">${escapeHtml(ctx)}</code></td><td><form class="inline" method="post" action="/campaign/${id}/assign/${a._id}/delete" style="display:inline"><input type="hidden" name="profile" value="${escapeHtml(profile.key)}"/><button type="submit">Entfernen</button></form></td></tr>`;
    }

    const assignSelect = await htmlSelectAllAssignments(db, visible);

    const alloc = await db
      .collection('campaign_allocations')
      .find({ campaignId: campaign._id })
      .sort({ weekStart: 1 })
      .toArray();
    let allocRows = '';
    for (const a of alloc) {
      const ws = a.weekStart ? new Date(a.weekStart).toISOString().slice(0, 10) : '';
      const amt = a.amount ? `${a.amount.value} ${a.amount.currency}` : '—';
      const sc = a.scope ? escapeHtml(JSON.stringify(a.scope)) : '—';
      allocRows += `<tr><td>${escapeHtml(ws)}</td><td><code>${escapeHtml(a.metric || '')}</code></td><td>${escapeHtml(amt)}</td><td class="small">${sc}</td><td><form class="inline" method="post" action="/campaign/${id}/alloc/${a._id}/delete" style="display:inline"><input type="hidden" name="profile" value="${escapeHtml(profile.key)}"/><button type="submit">Löschen</button></form></td></tr>`;
    }

    const chEntries = await db
      .collection('taxonomy_entries')
      .find({ type: 'channel', active: true })
      .sort({ label: 1 })
      .toArray();
    const mEntries = await db
      .collection('taxonomy_entries')
      .find({ type: 'market', active: true })
      .sort({ label: 1 })
      .toArray();
    let selCh =
      '<select name="channelEntryId"><option value="">— optional —</option>';
    for (const e of chEntries) {
      selCh += `<option value="${e._id}">${escapeHtml(e.label)}</option>`;
    }
    selCh += '</select>';
    let selM =
      '<select name="marketEntryId"><option value="">— optional —</option>';
    for (const e of mEntries) {
      selM += `<option value="${e._id}">${escapeHtml(e.label)}</option>`;
    }
    selM += '</select>';

    const bc = `<p class="breadcrumb"><a href="/">Marken</a> / <a href="/brand/${brand._id}">${escapeHtml(brand.name)}</a> / <a href="/company/${company._id}">${escapeHtml(company.name)}</a> / <strong>${escapeHtml(campaign.name)}</strong></p>`;

    const assignPanel = `<div class="panel"><h2>Zuordnungen (Dictionary → diese Kampagne)</h2>${profileNav}<form method="post" action="/campaign/${id}/assign" style="margin-top:0.75rem"><input type="hidden" name="profile" value="${escapeHtml(profile.key)}"/><p>Eintrag hinzufügen (gefiltert nach Ansicht-Typen):</p><p>${assignSelect}</p><p><label>Context (JSON, optional) <input name="contextJson" style="width:100%;max-width:28rem" placeholder='{"note":"…"}'/></label></p><button type="submit">Zuordnung speichern</button></form><h3>Aktive Zuordnungen</h3><table><thead><tr><th>Typ</th><th>Label</th><th>context</th><th></th></tr></thead><tbody>${assignRows || '<tr><td colspan="4">Keine</td></tr>'}</tbody></table></div>`;

    const allocPanel = `<div class="panel"><h2>Allokationen (operative Fakten)</h2><form method="post" action="/campaign/${id}/alloc"><input type="hidden" name="profile" value="${escapeHtml(profile.key)}"/><p><label>Wochenbeginn <input type="date" name="weekStart" required/></label> <label>Metric <select name="metric"><option value="planned_spend">planned_spend</option></select></label> <label>Betrag <input name="value" type="number" step="0.01" required/></label> <label>Währung <input name="currency" value="EUR" size="4"/></label></p><p><label>Kanal ${selCh}</label> <label>Markt ${selM}</label></p><button type="submit">Allokation hinzufügen</button></form><table><thead><tr><th>Woche</th><th>Metric</th><th>Betrag</th><th>scope</th><th></th></tr></thead><tbody>${allocRows || '<tr><td colspan="5">Keine</td></tr>'}</tbody></table></div>`;

    const inner = `<h1>Kampagne: ${escapeHtml(campaign.name)}</h1><p class="small">Code: <code>${escapeHtml(campaign.code || '—')}</code></p>${assignPanel}${allocPanel}`;
    res.type('html').send(layout(campaign.name, inner, bc));
  } catch (e) {
    res.status(500).send(String(e));
  }
});

app.post('/campaign/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const profileKey = (req.body.profile || 'media').toString();
    if (!ObjectId.isValid(id)) return res.status(400).send('Ungültige ID');
    const entryId = req.body.taxonomyEntryId;
    if (!entryId || !ObjectId.isValid(entryId)) return res.status(400).send('Eintrag fehlt');
    let context = {};
    const raw = (req.body.contextJson || '').trim();
    if (raw) {
      try {
        context = JSON.parse(raw);
        if (typeof context !== 'object' || context === null) context = {};
      } catch (_) {
        return res.status(400).send('Context: ungültiges JSON');
      }
    }
    const db = await getDb();
    const entry = await db.collection('taxonomy_entries').findOne({ _id: new ObjectId(entryId) });
    if (!entry) return res.status(404).send('Taxonomie-Eintrag nicht gefunden');
    const profile = await loadProfile(db, profileKey);
    const visible = profile.visibleTaxonomyTypes || [];
    if (visible.length && !visible.includes(entry.type)) {
      return res.status(400).send('Dieser Typ ist in der aktuellen Ansicht nicht vorgesehen (Profil wechseln).');
    }
    await db.collection('campaign_assignments').updateOne(
      { campaignId: new ObjectId(id), taxonomyEntryId: entry._id },
      {
        $set: {
          taxonomyType: entry.type,
          context,
          updatedAt: new Date(),
        },
        $setOnInsert: { campaignId: new ObjectId(id), createdAt: new Date() },
      },
      { upsert: true }
    );
    res.redirect(303, `/campaign/${id}?profile=${encodeURIComponent(profileKey)}`);
  } catch (e) {
    if (e.code === 11000) return res.status(400).send('Zuordnung existiert bereits');
    res.status(500).send(String(e));
  }
});

app.post('/campaign/:id/assign/:aid/delete', async (req, res) => {
  try {
    const { id, aid } = req.params;
    const profileKey = (req.body.profile || 'media').toString();
    if (!ObjectId.isValid(id) || !ObjectId.isValid(aid)) return res.status(400).send('Ungültige ID');
    const db = await getDb();
    await db.collection('campaign_assignments').deleteOne({ _id: new ObjectId(aid), campaignId: new ObjectId(id) });
    res.redirect(303, `/campaign/${id}?profile=${encodeURIComponent(profileKey)}`);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

app.post('/campaign/:id/alloc', async (req, res) => {
  try {
    const { id } = req.params;
    const profileKey = (req.body.profile || 'media').toString();
    if (!ObjectId.isValid(id)) return res.status(400).send('Ungültige ID');
    const weekStart = req.body.weekStart;
    if (!weekStart) return res.status(400).send('Datum fehlt');
    const value = parseFloat(req.body.value, 10);
    const currency = (req.body.currency || 'EUR').trim();
    const metric = (req.body.metric || 'planned_spend').trim();
    const scope = {};
    if (req.body.channelEntryId && ObjectId.isValid(req.body.channelEntryId)) {
      scope.channelEntryId = new ObjectId(req.body.channelEntryId);
    }
    if (req.body.marketEntryId && ObjectId.isValid(req.body.marketEntryId)) {
      scope.marketEntryId = new ObjectId(req.body.marketEntryId);
    }
    const db = await getDb();
    await db.collection('campaign_allocations').insertOne({
      campaignId: new ObjectId(id),
      weekStart: new Date(weekStart + 'T12:00:00.000Z'),
      metric,
      amount: { value, currency },
      scope: Object.keys(scope).length ? scope : undefined,
      createdAt: new Date(),
    });
    res.redirect(303, `/campaign/${id}?profile=${encodeURIComponent(profileKey)}`);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

app.post('/campaign/:id/alloc/:oid/delete', async (req, res) => {
  try {
    const { id, oid } = req.params;
    const profileKey = (req.body.profile || 'media').toString();
    if (!ObjectId.isValid(id) || !ObjectId.isValid(oid)) return res.status(400).send('Ungültige ID');
    const db = await getDb();
    await db.collection('campaign_allocations').deleteOne({ _id: new ObjectId(oid), campaignId: new ObjectId(id) });
    res.redirect(303, `/campaign/${id}?profile=${encodeURIComponent(profileKey)}`);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

app.get('/taxonomy', async (req, res) => {
  try {
    const db = await getDb();
    const filterType = (req.query.type || '').trim();
    const q = filterType ? { type: filterType } : {};
    const entries = await db.collection('taxonomy_entries').find(q).sort({ type: 1, label: 1 }).toArray();
    let rows = '';
    for (const e of entries) {
      const attr = e.attributes && Object.keys(e.attributes).length ? JSON.stringify(e.attributes) : '—';
      rows += `<tr><td><code>${escapeHtml(e.type)}</code></td><td>${escapeHtml(e.label)}</td><td><code>${escapeHtml(e.name)}</code></td><td>${e.active ? 'ja' : 'nein'}</td><td class="small">${escapeHtml(attr)}</td></tr>`;
    }
    const types = await db.collection('taxonomy_entries').distinct('type');
    let typeFilter = '<form method="get" style="margin:0.5rem 0">Typ <select name="type" onchange="this.form.submit()"><option value="">Alle</option>';
    for (const t of types.sort()) {
      typeFilter += `<option value="${escapeHtml(t)}"${t === filterType ? ' selected' : ''}>${escapeHtml(t)}</option>`;
    }
    typeFilter += '</select> <noscript><button type="submit">Filtern</button></noscript></form>';

    const allForLink = await db.collection('taxonomy_entries').find({ active: true }).sort({ type: 1, label: 1 }).toArray();
    let optsFrom = '<select name="fromEntryId" required><option value="">— von —</option>';
    let optsTo = '<select name="toEntryId" required><option value="">— nach —</option>';
    for (const e of allForLink) {
      const lab = `${e.type}: ${e.label}`;
      optsFrom += `<option value="${e._id}">${escapeHtml(lab)}</option>`;
      optsTo += `<option value="${e._id}">${escapeHtml(lab)}</option>`;
    }
    optsFrom += '</select>';
    optsTo += '</select>';

    const links = await db
      .collection('taxonomy_links')
      .aggregate([
        {
          $lookup: {
            from: 'taxonomy_entries',
            localField: 'fromEntryId',
            foreignField: '_id',
            as: 'fromE',
          },
        },
        { $unwind: '$fromE' },
        {
          $lookup: {
            from: 'taxonomy_entries',
            localField: 'toEntryId',
            foreignField: '_id',
            as: 'toE',
          },
        },
        { $unwind: '$toE' },
        { $sort: { relation: 1 } },
        { $limit: 80 },
      ])
      .toArray();
    let linkRows = '';
    for (const l of links) {
      linkRows += `<tr><td><code>${escapeHtml(l.relation)}</code></td><td>${escapeHtml(l.fromE.label)}</td><td>→</td><td>${escapeHtml(l.toE.label)}</td></tr>`;
    }

    const inner = `<h1>Taxonomie (Wörterbuch)</h1><p class="small">Global wiederverwendbare Bausteine und Regeln zwischen ihnen.</p>${typeFilter}<table><thead><tr><th>Typ</th><th>Label</th><th>name</th><th>aktiv</th><th>attributes</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Keine Einträge</td></tr>'}</tbody></table><div class="panel"><h2>Neuer Eintrag</h2><form method="post" action="/taxonomy/entry"><p><label>Typ <input name="type" required placeholder="channel"/></label> <label>name <input name="name" required placeholder="youtube"/></label> <label>Label <input name="label" required placeholder="YouTube"/></label></p><p><label>Beschreibung <input name="description" style="width:100%;max-width:32rem"/></label></p><p><label>Attributes JSON <input name="attributesJson" style="width:100%;max-width:32rem" placeholder='{"maxKb":200}'/></label></p><button type="submit">Speichern</button></form></div><div class="panel"><h2>Neue Regel (Link)</h2><form method="post" action="/taxonomy/link"><p><label>Relation <select name="relation"><option value="allows_format">allows_format</option><option value="allows_file_type">allows_file_type</option><option value="allows_device">allows_device</option><option value="allows_language">allows_language</option><option value="suggests_cta">suggests_cta</option></select></label></p><p>${optsFrom} ${optsTo}</p><button type="submit">Link speichern</button></form><h3>Beispiel-Links</h3><table><thead><tr><th>Relation</th><th>Von</th><th></th><th>Nach</th></tr></thead><tbody>${linkRows || '<tr><td colspan="4">Keine</td></tr>'}</tbody></table></div>`;
    res.type('html').send(layout('Taxonomie', inner));
  } catch (e) {
    res.status(500).send(String(e));
  }
});

app.post('/taxonomy/entry', async (req, res) => {
  try {
    const type = (req.body.type || '').trim();
    const name = (req.body.name || '').trim();
    const label = (req.body.label || '').trim();
    const description = (req.body.description || '').trim() || undefined;
    if (!type || !name || !label) return res.status(400).send('Pflichtfelder');
    let attributes = {};
    const raw = (req.body.attributesJson || '').trim();
    if (raw) {
      try {
        attributes = JSON.parse(raw);
        if (typeof attributes !== 'object' || attributes === null) attributes = {};
      } catch (_) {
        return res.status(400).send('attributes: kein JSON');
      }
    }
    const db = await getDb();
    await db.collection('taxonomy_entries').insertOne({
      type,
      name,
      label,
      description,
      active: true,
      attributes,
      createdAt: new Date(),
    });
    res.redirect(303, '/taxonomy');
  } catch (e) {
    if (e.code === 11000) return res.status(400).send('type+name bereits vergeben');
    res.status(500).send(String(e));
  }
});

app.post('/taxonomy/link', async (req, res) => {
  try {
    const relation = (req.body.relation || '').trim();
    const from = req.body.fromEntryId;
    const to = req.body.toEntryId;
    if (!relation || !ObjectId.isValid(from) || !ObjectId.isValid(to)) return res.status(400).send('Ungültig');
    const db = await getDb();
    await db.collection('taxonomy_links').insertOne({
      relation,
      fromEntryId: new ObjectId(from),
      toEntryId: new ObjectId(to),
      metadata: {},
      createdAt: new Date(),
    });
    res.redirect(303, '/taxonomy');
  } catch (e) {
    if (e.code === 11000) return res.status(400).send('Link existiert bereits');
    res.status(500).send(String(e));
  }
});

app.get('/profiles', async (req, res) => {
  try {
    const db = await getDb();
    const profiles = await db.collection('view_profiles').find().sort({ key: 1 }).toArray();
    let rows = '';
    for (const p of profiles) {
      const chips = (p.visibleTaxonomyTypes || []).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join(' ');
      rows += `<tr><td><code>${escapeHtml(p.key)}</code></td><td>${escapeHtml(p.label)}</td><td>${chips}</td><td class="small">${escapeHtml(p.description || '')}</td></tr>`;
    }
    const inner = `<h1>Ansichtsprofile (nur Navigation/UI)</h1><p class="small">Profil wechseln kannst du auf einer <strong>Kampagnen-Seite</strong> – hier nur die Übersicht.</p><table><thead><tr><th>key</th><th>Label</th><th>visibleTaxonomyTypes</th><th>Beschreibung</th></tr></thead><tbody>${rows}</tbody></table>`;
    res.type('html').send(layout('Ansichten', inner));
  } catch (e) {
    res.status(500).send(String(e));
  }
});

async function main() {
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  const db = await getDb();
  await ensureIndexes(db);
  await seedMvpIfEmpty(db);
  app.listen(port, '0.0.0.0', () => {
    console.log('Listening on ' + port);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
