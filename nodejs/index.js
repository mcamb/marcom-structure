/**
 * Admin: brands, European countries (seeded), campaigns.
 * Layout: server-rendered shell (sidebar + sticky header + panels).
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
  --bg: #f4f4f5;
  --surface: #ffffff;
  --border: #e4e4e7;
  --border-strong: #d4d4d8;
  --text: #18181b;
  --text-muted: #71717a;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-soft: #eff6ff;
  --danger: #dc2626;
  --danger-soft: #fef2f2;
  --radius: 12px;
  --radius-sm: 8px;
  --radius-pill: 9999px;
  --shadow: 0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06);
  --shadow-lg: 0 4px 24px rgba(0,0,0,0.06);
  --nav-bg: #0a0a0b;
  --nav-border: rgba(255,255,255,0.08);
  --nav-text: #fafafa;
  --nav-muted: #a1a1aa;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --dur: 0.18s;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
* { box-sizing: border-box; }
html { -webkit-font-smoothing: antialiased; }
body {
  margin: 0;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.55;
  color: var(--text);
  background: var(--bg);
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
}
.app-shell { display: flex; min-height: 100vh; }
.nav-drawer {
  width: 260px;
  flex-shrink: 0;
  background: var(--nav-bg);
  border-right: 1px solid var(--nav-border);
  padding: 1.25rem 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.nav-drawer__brand {
  padding: 0 1.25rem 1rem;
  border-bottom: 1px solid var(--nav-border);
  margin-bottom: 0.25rem;
}
.nav-drawer__logo {
  display: block;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--nav-text);
}
.nav-drawer__tagline {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--nav-muted);
  line-height: 1.35;
}
.nav-drawer__links {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 0.75rem;
}
.nav-drawer__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.875rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--nav-muted);
  font-weight: 500;
  font-size: 0.9375rem;
  border: 1px solid transparent;
  transition: color var(--dur) var(--ease), background var(--dur) var(--ease), border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.nav-drawer__item .material-symbols-outlined {
  font-size: 22px;
  font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
  opacity: 0.85;
}
.nav-drawer__item:hover {
  color: var(--nav-text);
  background: rgba(255,255,255,0.06);
}
.nav-drawer__item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.nav-drawer__item--active {
  color: var(--nav-text);
  background: rgba(37, 99, 235, 0.15);
  border-color: rgba(37, 99, 235, 0.35);
}
.nav-drawer__item--active .material-symbols-outlined { opacity: 1; }
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.top-app-bar {
  display: flex;
  align-items: center;
  min-height: 4rem;
  padding: 0 1.75rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
}
.top-app-bar__headline {
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  margin: 0;
  color: var(--text);
}
.content-padding {
  padding: 1.75rem;
  max-width: 56rem;
  width: 100%;
  margin: 0 auto;
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.5rem 1.5rem 1.625rem;
  margin-bottom: 1.25rem;
  transition: box-shadow var(--dur) var(--ease);
}
@media (hover: hover) {
  .card:hover { box-shadow: var(--shadow-lg); }
}
.panel-title {
  margin: 0 0 1.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.hint { font-weight: 400; color: var(--text-muted); font-size: 0.875em; }
.form-row { margin-bottom: 1.125rem; }
.form-row label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 0.5rem;
}
.text-field {
  width: 100%;
  max-width: 100%;
  padding: 0.65rem 0.875rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font: inherit;
  color: var(--text);
  background: var(--surface);
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.text-field::placeholder { color: #a1a1aa; }
.text-field:hover { border-color: #a1a1aa; }
.text-field:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}
.text-field:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}
.select-searchable { max-width: 100%; }
select.text-field:not([size]) {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.25rem;
}
select.text-field[size] {
  background-image: none;
  padding-right: 0.875rem;
  cursor: default;
}
.btn-filled {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0 1.25rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.25);
  transition: background var(--dur) var(--ease), transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.btn-filled:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}
.btn-filled:active { transform: translateY(0); }
.btn-filled:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.35);
}
.btn-ghost {
  background: transparent;
  color: var(--text-muted);
  border: none;
  font: inherit;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  transition: color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.btn-ghost:hover { color: var(--text); background: #f4f4f5; }
.btn-ghost:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent);
}
.btn-ghost--danger { color: var(--danger); }
.btn-ghost--danger:hover { background: var(--danger-soft); color: #b91c1c; }
.table-wrap {
  overflow-x: auto;
  margin: 0 -0.25rem;
  padding: 0 0.25rem;
  -webkit-overflow-scrolling: touch;
}
.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.data-table th {
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: #fafafa;
  white-space: nowrap;
}
.data-table th:first-child { border-radius: var(--radius-sm) 0 0 0; }
.data-table th:last-child { border-radius: 0 var(--radius-sm) 0 0; }
.data-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  font-size: 0.9375rem;
}
.data-table td.cell-muted { font-size: 0.8125rem; color: var(--text-muted); line-height: 1.45; }
.data-table tbody tr {
  transition: background var(--dur) var(--ease);
}
.data-table tbody tr:hover { background: #fafafa; }
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr:last-child td:first-child { border-radius: 0 0 0 var(--radius-sm); }
.data-table tbody tr:last-child td:last-child { border-radius: 0 0 var(--radius-sm) 0; }
.code-pill {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.8125rem;
  padding: 0.2rem 0.45rem;
  background: #f4f4f5;
  border-radius: 4px;
  color: var(--text);
}
.banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  margin-bottom: 1.25rem;
  font-size: 0.9375rem;
  animation: banner-in 0.35s var(--ease);
}
@keyframes banner-in {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
.banner .material-symbols-outlined { font-size: 20px; color: #059669; }
.empty-state {
  color: var(--text-muted);
  padding: 2.5rem 1rem;
  text-align: center;
  font-size: 0.9375rem;
  line-height: 1.6;
}
.empty-state a { color: var(--accent); font-weight: 500; text-underline-offset: 3px; }
.empty-state a:hover { color: var(--accent-hover); }
.country-panel {
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.25rem;
  max-height: 280px;
  overflow-y: auto;
  background: var(--surface);
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}
.country-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.45rem 0.5rem;
  margin: 0 0.25rem;
  border-radius: 6px;
  transition: background var(--dur) var(--ease);
}
.country-row:hover { background: var(--accent-soft); }
.country-row input {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--accent);
  cursor: pointer;
}
.country-row label { flex: 1; cursor: pointer; font-size: 0.9375rem; }
.country-row .country-code { opacity: 0.55; font-size: 0.8125rem; }
.country-row.hidden { display: none; }
.date-row { display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: flex-end; }
.date-row .form-row { margin-bottom: 0; }
.date-input { max-width: 12rem; }
@media (max-width: 768px) {
  .app-shell { flex-direction: column; }
  .nav-drawer {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    padding: 1rem 1rem 1rem;
    border-right: none;
    border-bottom: 1px solid var(--nav-border);
  }
  .nav-drawer__brand {
    flex: 1 1 100%;
    padding: 0 0 0.75rem;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid var(--nav-border);
  }
  .nav-drawer__links {
    flex-direction: row;
    flex: 1;
    gap: 0.5rem;
    padding: 0;
  }
  .nav-drawer__item { flex: 1; justify-content: center; }
  .content-padding { padding: 1.25rem 1rem; }
  .top-app-bar { padding: 0 1.25rem; min-height: 3.5rem; }
}
`;

function layout({ title, navActive, body, banner }) {
  const navBrands =
    navActive === 'brands' ? 'nav-drawer__item nav-drawer__item--active' : 'nav-drawer__item';
  const navCampaigns =
    navActive === 'campaigns' ? 'nav-drawer__item nav-drawer__item--active' : 'nav-drawer__item';
  const ariaBrands = navActive === 'brands' ? ' aria-current="page"' : '';
  const ariaCampaigns = navActive === 'campaigns' ? ' aria-current="page"' : '';
  const b = banner
    ? `<div class="banner" role="status"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span><span>${banner}</span></div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0a0a0b">
  <title>${escapeHtml(title)} — Marcom</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet">
  <style>${STYLES}</style>
</head>
<body>
  <div class="app-shell">
    <nav class="nav-drawer" aria-label="Main navigation">
      <div class="nav-drawer__brand">
        <span class="nav-drawer__logo">Marcom</span>
        <span class="nav-drawer__tagline">Brand &amp; campaign admin</span>
      </div>
      <div class="nav-drawer__links">
        <a class="${navBrands}" href="/brands"${ariaBrands}>
          <span class="material-symbols-outlined" aria-hidden="true">storefront</span>
          Brands
        </a>
        <a class="${navCampaigns}" href="/campaigns"${ariaCampaigns}>
          <span class="material-symbols-outlined" aria-hidden="true">campaign</span>
          Campaigns
        </a>
      </div>
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
        <td><span class="code-pill">${escapeHtml(b.slug)}</span></td>
        <td style="text-align:right">
          <form method="post" action="/brands/${b._id}/delete" style="display:inline" onsubmit="return confirm('Delete this brand?');">
            <button type="submit" class="btn-ghost btn-ghost--danger">Delete</button>
          </form>
        </td>
      </tr>`;
    }
    const table =
      brands.length === 0
        ? '<p class="empty-state">No brands yet. Add your first brand below.</p>'
        : `<div class="table-wrap"><table class="data-table" role="grid">
            <thead><tr><th>Name</th><th>Slug</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`;

    const body = `
      <div class="card">
        <h2 class="panel-title">All brands</h2>
        ${table}
      </div>
      <div class="card">
        <h2 class="panel-title">Add brand</h2>
        <form method="post" action="/brands">
          <div class="form-row">
            <label for="name">Name</label>
            <input class="text-field" id="name" name="name" required maxlength="120" placeholder="e.g. Acme Motors" autocomplete="organization">
          </div>
          <div class="form-row">
            <label for="slug">Slug <span class="hint">(optional)</span></label>
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
        <label for="c_${c._id}">${escapeHtml(c.name)} <span class="country-code">(${escapeHtml(c.code)})</span></label>
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
        <td class="cell-muted">${escapeHtml(names)}</td>
        <td>${escapeHtml(sd)}</td>
        <td>${escapeHtml(ed)}</td>
        <td style="text-align:right">
          <form method="post" action="/campaigns/${c._id}/delete" style="display:inline" onsubmit="return confirm('Delete this campaign?');">
            <button type="submit" class="btn-ghost btn-ghost--danger">Delete</button>
          </form>
        </td>
      </tr>`;
    }

    const table =
      campaignsAgg.length === 0
        ? '<p class="empty-state">No campaigns yet. Create one below.</p>'
        : `<div class="table-wrap"><table class="data-table">
            <thead><tr><th>Brand</th><th>Campaign</th><th>Countries</th><th>Start</th><th>End</th><th></th></tr></thead>
            <tbody>${campRows}</tbody>
          </table></div>`;

    const noBrands = brands.length === 0;

    const body = `
      <div class="card">
        <h2 class="panel-title">All campaigns</h2>
        ${table}
      </div>
      <div class="card">
        <h2 class="panel-title">New campaign</h2>
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
            <label>Countries <span class="hint">(select one or more)</span></label>
            <div class="country-panel" id="countryPanel">${countryRows}</div>
          </div>
          <div class="form-row date-row">
            <div>
              <label for="startDate">Start date</label>
              <input class="text-field date-input" type="date" id="startDate" name="startDate" required>
            </div>
            <div>
              <label for="endDate">End date</label>
              <input class="text-field date-input" type="date" id="endDate" name="endDate" required>
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
