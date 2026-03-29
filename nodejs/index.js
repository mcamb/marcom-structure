/**
 * Admin: brands, European countries (seeded), campaigns.
 * Layout: MD3-style navigation drawer + main.
 */
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;
const DB_NAME = 'marcom';

app.use(express.urlencoded({ extended: true }));

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

function slugify(name) {
  const s = String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'brand';
}

async function ensureUniqueSlug(db, base) {
  const col = db.collection('brands');
  let slug = base;
  let n = 0;
  while (await col.findOne({ slug })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

/** ISO 3166-1 alpha-2 — sovereign states in geographic Europe (incl. UK, CH, NO, microstates). */
const EUROPE_COUNTRIES = [
  { code: 'AD', name: 'Andorra' },
  { code: 'AL', name: 'Albania' },
  { code: 'AT', name: 'Austria' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BY', name: 'Belarus' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DE', name: 'Germany' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'ES', name: 'Spain' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'GR', name: 'Greece' },
  { code: 'HR', name: 'Croatia' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'LV', name: 'Latvia' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MD', name: 'Moldova' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'RS', name: 'Serbia' },
  { code: 'RU', name: 'Russia' },
  { code: 'SE', name: 'Sweden' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SM', name: 'San Marino' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'VA', name: 'Vatican City' },
  { code: 'XK', name: 'Kosovo' },
];

const STYLES = `
:root {
  --md-sys-color-primary: #6750A4;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #EADDFF;
  --md-sys-color-surface: #FEF7FF;
  --md-sys-color-surface-container: #F3EDF7;
  --md-sys-color-on-surface: #1D1B20;
  --md-sys-color-on-surface-variant: #49454F;
  --md-sys-color-outline: #79747E;
  --md-sys-elevation-1: 0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15);
  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-small: 8px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Roboto", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface);
  background: var(--md-sys-color-surface);
}
.app-shell { display: flex; min-height: 100vh; }
.nav-drawer {
  width: 256px;
  flex-shrink: 0;
  background: var(--md-sys-color-surface-container);
  border-right: 1px solid color-mix(in srgb, var(--md-sys-color-outline) 20%, transparent);
  padding: 12px 0 24px;
}
.nav-drawer__title {
  padding: 16px 28px 8px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: var(--md-sys-color-on-surface-variant);
  text-transform: uppercase;
}
.nav-drawer__item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 12px;
  padding: 12px 16px;
  border-radius: 24px;
  text-decoration: none;
  color: var(--md-sys-color-on-surface);
  font-weight: 500;
}
.nav-drawer__item .material-symbols-outlined { font-size: 24px; opacity: 0.9; }
.nav-drawer__item--active {
  background: #E8DEF8;
  color: #1D192B;
}
.main-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.top-app-bar {
  display: flex;
  align-items: center;
  min-height: 64px;
  padding: 8px 24px;
  background: var(--md-sys-color-surface);
  border-bottom: 1px solid color-mix(in srgb, var(--md-sys-color-outline) 16%, transparent);
}
.top-app-bar__headline { font-size: 22px; font-weight: 400; margin: 0; }
.content-padding { padding: 24px; max-width: 960px; }
.card {
  background: #F7F2FA;
  border-radius: var(--md-sys-shape-corner-medium);
  box-shadow: var(--md-sys-elevation-1);
  padding: 24px;
  margin-bottom: 24px;
}
.form-row { margin-bottom: 16px; }
.form-row label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  margin-bottom: 8px;
}
.text-field {
  width: 100%;
  max-width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 4px;
  font: inherit;
  background: var(--md-sys-color-surface);
}
.text-field:focus {
  outline: 2px solid var(--md-sys-color-primary);
  border-color: transparent;
}
.select-searchable { max-width: 100%; }
.btn-filled {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 24px;
  border: none;
  border-radius: 20px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--md-sys-elevation-1);
}
.btn-text {
  background: transparent;
  color: var(--md-sys-color-primary);
  border: none;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 20px;
}
.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  padding: 12px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--md-sys-color-outline) 30%, transparent);
}
.data-table td {
  padding: 14px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--md-sys-color-outline) 16%, transparent);
  vertical-align: top;
}
.data-table tr:last-child td { border-bottom: none; }
.banner {
  padding: 12px 16px;
  border-radius: var(--md-sys-shape-corner-small);
  background: var(--md-sys-color-primary-container);
  margin-bottom: 16px;
  font-size: 14px;
}
.empty-state { color: var(--md-sys-color-on-surface-variant); padding: 24px 0; text-align: center; }
.country-panel {
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 8px;
  padding: 12px;
  max-height: 280px;
  overflow-y: auto;
  background: var(--md-sys-color-surface);
}
.country-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  border-radius: 4px;
}
.country-row:hover { background: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent); }
.country-row input { width: 18px; height: 18px; }
.country-row label { flex: 1; cursor: pointer; font-size: 14px; }
.country-row.hidden { display: none; }
.date-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
.date-row .form-row { margin-bottom: 0; }
`;

function layout({ title, navActive, body, banner }) {
  const navBrands =
    navActive === 'brands' ? 'nav-drawer__item nav-drawer__item--active' : 'nav-drawer__item';
  const navCampaigns =
    navActive === 'campaigns' ? 'nav-drawer__item nav-drawer__item--active' : 'nav-drawer__item';
  const b = banner ? `<div class="banner" role="status">${banner}</div>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — Marcom</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet">
  <style>${STYLES}</style>
</head>
<body>
  <div class="app-shell">
    <nav class="nav-drawer" aria-label="Main navigation">
      <div class="nav-drawer__title">Menu</div>
      <a class="${navBrands}" href="/brands">
        <span class="material-symbols-outlined" aria-hidden="true">storefront</span>
        Brands
      </a>
      <a class="${navCampaigns}" href="/campaigns">
        <span class="material-symbols-outlined" aria-hidden="true">campaign</span>
        Campaigns
      </a>
    </nav>
    <div class="main-area">
      <header class="top-app-bar">
        <h1 class="top-app-bar__headline">${escapeHtml(title)}</h1>
      </header>
      <div class="content-padding">${b}${body}</div>
    </div>
  </div>
</body>
</html>`;
}

async function ensureIndexes(db) {
  await db.collection('brands').createIndex({ slug: 1 }, { unique: true });
  await db.collection('countries').createIndex({ code: 1 }, { unique: true });
  await db.collection('campaigns').createIndex({ brandId: 1 });
  await db.collection('campaigns').createIndex({ startDate: 1, endDate: 1 });
}

async function seedCountriesIfEmpty(db) {
  const col = db.collection('countries');
  if ((await col.countDocuments()) > 0) return;
  const now = new Date();
  const docs = EUROPE_COUNTRIES.map((c) => ({
    code: c.code,
    name: c.name,
    createdAt: now,
  }));
  await col.insertMany(docs);
}

app.get('/', (req, res) => {
  res.redirect(302, '/brands');
});

app.get('/brands', async (req, res) => {
  try {
    const db = await getDb();
    const added = req.query.added === '1';
    const deleted = req.query.deleted === '1';
    let banner = '';
    if (added) banner = 'Brand saved successfully.';
    if (deleted) banner = 'Brand removed.';

    const brands = await db.collection('brands').find().sort({ name: 1 }).toArray();
    let rows = '';
    for (const b of brands) {
      rows += `<tr>
        <td>${escapeHtml(b.name)}</td>
        <td><code style="font-size:13px">${escapeHtml(b.slug)}</code></td>
        <td style="text-align:right">
          <form method="post" action="/brands/${b._id}/delete" style="display:inline" onsubmit="return confirm('Delete this brand?');">
            <button type="submit" class="btn-text">Delete</button>
          </form>
        </td>
      </tr>`;
    }
    const table =
      brands.length === 0
        ? '<p class="empty-state">No brands yet. Add your first brand below.</p>'
        : `<table class="data-table" role="grid">
            <thead><tr><th>Name</th><th>Slug</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;

    const body = `
      <div class="card">
        <h2 style="margin:0 0 16px;font-size:16px;font-weight:500;">All brands</h2>
        ${table}
      </div>
      <div class="card">
        <h2 style="margin:0 0 16px;font-size:16px;font-weight:500;">Add brand</h2>
        <form method="post" action="/brands">
          <div class="form-row">
            <label for="name">Name</label>
            <input class="text-field" id="name" name="name" required maxlength="120" placeholder="e.g. Acme Motors" autocomplete="organization">
          </div>
          <div class="form-row">
            <label for="slug">Slug <span style="font-weight:400;opacity:0.8">(optional)</span></label>
            <input class="text-field" id="slug" name="slug" maxlength="80" placeholder="Leave empty to auto-generate from name">
          </div>
          <button type="submit" class="btn-filled">
            <span class="material-symbols-outlined" style="font-size:20px">add</span>
            Add brand
          </button>
        </form>
      </div>`;

    res.type('html').send(layout({ title: 'Brands', navActive: 'brands', body, banner: banner || null }));
  } catch (e) {
    res.status(500).send(`<pre>${escapeHtml(String(e.message || e))}</pre>`);
  }
});

app.post('/brands', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).send('Name is required');
    let slug = (req.body.slug || '').trim();
    if (!slug) slug = await ensureUniqueSlug(await getDb(), slugify(name));
    else slug = await ensureUniqueSlug(await getDb(), slugify(slug));

    const db = await getDb();
    await db.collection('brands').insertOne({
      name,
      slug,
      createdAt: new Date(),
    });
    res.redirect(303, '/brands?added=1');
  } catch (e) {
    if (e.code === 11000) return res.status(400).send('That slug already exists. Try another name or slug.');
    res.status(500).send(String(e.message || e));
  }
});

app.post('/brands/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).send('Invalid id');
    const db = await getDb();
    await db.collection('brands').deleteOne({ _id: new ObjectId(id) });
    res.redirect(303, '/brands?deleted=1');
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

app.get('/campaigns', async (req, res) => {
  try {
    const db = await getDb();
    await seedCountriesIfEmpty(db);

    const added = req.query.added === '1';
    const deleted = req.query.deleted === '1';
    let banner = '';
    if (added) banner = 'Campaign saved successfully.';
    if (deleted) banner = 'Campaign removed.';

    const brands = await db.collection('brands').find().sort({ name: 1 }).toArray();
    let brandOptions = '';
    for (const b of brands) {
      brandOptions += `<option value="${b._id.toString()}">${escapeHtml(b.name)}</option>`;
    }

    const countries = await db.collection('countries').find().sort({ name: 1 }).toArray();
    let countryRows = '';
    for (const c of countries) {
      countryRows += `<div class="country-row" data-label="${escapeHtml(c.name.toLowerCase())} ${escapeHtml(c.code.toLowerCase())}">
        <input type="checkbox" name="countryIds" value="${c._id.toString()}" id="c_${c._id}">
        <label for="c_${c._id}">${escapeHtml(c.name)} <span style="opacity:0.6;font-size:12px">(${escapeHtml(c.code)})</span></label>
      </div>`;
    }

    const campaignsAgg = await db
      .collection('campaigns')
      .aggregate([
        { $sort: { startDate: -1 } },
        {
          $lookup: {
            from: 'brands',
            localField: 'brandId',
            foreignField: '_id',
            as: 'brand',
          },
        },
        { $unwind: '$brand' },
      ])
      .toArray();

    const allCountryIds = [...new Set(campaignsAgg.flatMap((c) => (c.countryIds || []).map((id) => id.toString())))];
    const countryMap = {};
    if (allCountryIds.length) {
      const oids = allCountryIds.filter((x) => ObjectId.isValid(x)).map((x) => new ObjectId(x));
      const cs = await db.collection('countries').find({ _id: { $in: oids } }).toArray();
      for (const x of cs) countryMap[x._id.toString()] = x.name;
    }

    let campRows = '';
    for (const c of campaignsAgg) {
      const names = (c.countryIds || []).map((id) => countryMap[id.toString()] || '—').join(', ');
      const sd = c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : '—';
      const ed = c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : '—';
      campRows += `<tr>
        <td>${escapeHtml(c.brand.name)}</td>
        <td>${escapeHtml(c.name)}</td>
        <td style="font-size:13px">${escapeHtml(names)}</td>
        <td>${escapeHtml(sd)}</td>
        <td>${escapeHtml(ed)}</td>
        <td style="text-align:right">
          <form method="post" action="/campaigns/${c._id}/delete" style="display:inline" onsubmit="return confirm('Delete this campaign?');">
            <button type="submit" class="btn-text">Delete</button>
          </form>
        </td>
      </tr>`;
    }

    const table =
      campaignsAgg.length === 0
        ? '<p class="empty-state">No campaigns yet. Create one below.</p>'
        : `<table class="data-table">
            <thead><tr><th>Brand</th><th>Campaign</th><th>Countries</th><th>Start</th><th>End</th><th></th></tr></thead>
            <tbody>${campRows}</tbody>
          </table>`;

    const noBrands = brands.length === 0;

    const body = `
      <div class="card">
        <h2 style="margin:0 0 16px;font-size:16px;font-weight:500;">All campaigns</h2>
        ${table}
      </div>
      <div class="card">
        <h2 style="margin:0 0 16px;font-size:16px;font-weight:500;">New campaign</h2>
        ${
          noBrands
            ? '<p class="empty-state">Add at least one brand first under <a href="/brands">Brands</a>.</p>'
            : `<form method="post" action="/campaigns" id="campaignForm">
          <div class="form-row">
            <label for="brandFilter">Brand — search</label>
            <input type="search" class="text-field" id="brandFilter" placeholder="Type to filter brands…" autocomplete="off">
          </div>
          <div class="form-row">
            <label for="brandId">Brand</label>
            <select name="brandId" id="brandId" class="text-field select-searchable" required size="6" style="max-height:180px">
              <option value="">— Select brand —</option>
              ${brandOptions}
            </select>
          </div>
          <div class="form-row">
            <label for="cname">Campaign name</label>
            <input class="text-field" id="cname" name="name" required maxlength="200" placeholder="e.g. Spring launch 2026">
          </div>
          <div class="form-row">
            <label for="countryFilter">Countries — search</label>
            <input type="search" class="text-field" id="countryFilter" placeholder="Filter countries…" autocomplete="off">
          </div>
          <div class="form-row">
            <label>Countries <span style="font-weight:400;opacity:0.8">(select one or more)</span></label>
            <div class="country-panel" id="countryPanel">${countryRows}</div>
          </div>
          <div class="form-row date-row">
            <div>
              <label for="startDate">Start date</label>
              <input class="text-field" type="date" id="startDate" name="startDate" required style="max-width:12rem">
            </div>
            <div>
              <label for="endDate">End date</label>
              <input class="text-field" type="date" id="endDate" name="endDate" required style="max-width:12rem">
            </div>
          </div>
          <button type="submit" class="btn-filled">
            <span class="material-symbols-outlined" style="font-size:20px">save</span>
            Save campaign
          </button>
        </form>
        <script>
        (function(){
          var bf = document.getElementById('brandFilter');
          var bs = document.getElementById('brandId');
          if (bf && bs) {
            bf.addEventListener('input', function() {
              var q = bf.value.toLowerCase();
              for (var i = 0; i < bs.options.length; i++) {
                var o = bs.options[i];
                if (!o.value) { o.hidden = false; continue; }
                o.hidden = o.text.toLowerCase().indexOf(q) === -1;
              }
            });
          }
          var cf = document.getElementById('countryFilter');
          var panel = document.getElementById('countryPanel');
          if (cf && panel) {
            cf.addEventListener('input', function() {
              var q = cf.value.toLowerCase();
              panel.querySelectorAll('.country-row').forEach(function(row) {
                var lab = row.getAttribute('data-label') || '';
                row.classList.toggle('hidden', q && lab.indexOf(q) === -1);
              });
            });
          }
        })();
        </script>`
        }
      </div>`;

    res.type('html').send(layout({ title: 'Campaigns', navActive: 'campaigns', body, banner: banner || null }));
  } catch (e) {
    res.status(500).send(`<pre>${escapeHtml(String(e.message || e))}</pre>`);
  }
});

app.post('/campaigns', async (req, res) => {
  try {
    const brandId = req.body.brandId;
    const name = (req.body.name || '').trim();
    const startDate = req.body.startDate;
    const endDate = req.body.endDate;
    let countryIds = req.body.countryIds;
    if (!brandId || !ObjectId.isValid(brandId)) return res.status(400).send('Valid brand is required');
    if (!name) return res.status(400).send('Campaign name is required');
    if (!startDate || !endDate) return res.status(400).send('Start and end dates are required');
    if (!countryIds) return res.status(400).send('Select at least one country');
    if (!Array.isArray(countryIds)) countryIds = [countryIds];
    countryIds = countryIds.filter((id) => ObjectId.isValid(id));
    if (countryIds.length === 0) return res.status(400).send('Select at least one country');

    const start = new Date(startDate + 'T12:00:00.000Z');
    const end = new Date(endDate + 'T12:00:00.000Z');
    if (end < start) return res.status(400).send('End date must be on or after start date');

    const db = await getDb();
    const brand = await db.collection('brands').findOne({ _id: new ObjectId(brandId) });
    if (!brand) return res.status(400).send('Brand not found');

    await db.collection('campaigns').insertOne({
      brandId: new ObjectId(brandId),
      name,
      countryIds: countryIds.map((id) => new ObjectId(id)),
      startDate: start,
      endDate: end,
      createdAt: new Date(),
    });
    res.redirect(303, '/campaigns?added=1');
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

app.post('/campaigns/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).send('Invalid id');
    const db = await getDb();
    await db.collection('campaigns').deleteOne({ _id: new ObjectId(id) });
    res.redirect(303, '/campaigns?deleted=1');
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

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

async function main() {
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  const db = await getDb();
  await ensureIndexes(db);
  await seedCountriesIfEmpty(db);
  app.listen(port, '0.0.0.0', () => {
    console.log('Listening on ' + port);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
