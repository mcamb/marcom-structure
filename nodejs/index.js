const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;
const DB_NAME = 'marcom';

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

async function ensureIndexes(db) {
  await db.collection('brands').createIndex({ slug: 1 }, { unique: true });
  await db.collection('companies').createIndex({ brandId: 1 });
  await db.collection('products').createIndex({ companyId: 1 });
  await db.collection('campaigns').createIndex({ companyId: 1 });
  await db.collection('campaigns').createIndex({ productIds: 1 });
}

async function seedIfEmpty(db) {
  const brandsCol = db.collection('brands');
  if ((await brandsCol.countDocuments()) > 0) return;

  await db.collection('campaigns').deleteMany({});
  await db.collection('products').deleteMany({});
  await db.collection('companies').deleteMany({});

  const now = new Date();

  const bmwId = (await brandsCol.insertOne({ name: 'BMW', slug: 'bmw', createdAt: now })).insertedId;
  const porscheId = (await brandsCol.insertOne({ name: 'Porsche', slug: 'porsche', createdAt: now })).insertedId;
  const manId = (await brandsCol.insertOne({ name: 'MAN Bus & Trucks', slug: 'man-bus-trucks', createdAt: now })).insertedId;

  const companiesCol = db.collection('companies');
  const bmwHqId = (await companiesCol.insertOne({ brandId: bmwId, name: 'BMW HQ', createdAt: now })).insertedId;
  const bmwDeId = (await companiesCol.insertOne({ brandId: bmwId, name: 'BMW Deutschland', createdAt: now })).insertedId;
  const porscheHqId = (await companiesCol.insertOne({ brandId: porscheId, name: 'Porsche HQ', createdAt: now })).insertedId;
  const manDeId = (await companiesCol.insertOne({ brandId: manId, name: 'MAN Truck & Bus DE', createdAt: now })).insertedId;

  const productsCol = db.collection('products');
  const x1 = (await productsCol.insertOne({ companyId: bmwDeId, name: 'X1', createdAt: now })).insertedId;
  const x2 = (await productsCol.insertOne({ companyId: bmwDeId, name: 'X2', createdAt: now })).insertedId;
  const x3 = (await productsCol.insertOne({ companyId: bmwDeId, name: 'X3', createdAt: now })).insertedId;
  const iX = (await productsCol.insertOne({ companyId: bmwHqId, name: 'iX', createdAt: now })).insertedId;
  const p911 = (await productsCol.insertOne({ companyId: porscheHqId, name: '911', createdAt: now })).insertedId;
  const cayenne = (await productsCol.insertOne({ companyId: porscheHqId, name: 'Cayenne', createdAt: now })).insertedId;
  const tgx = (await productsCol.insertOne({ companyId: manDeId, name: 'TGX', createdAt: now })).insertedId;
  const lionsCity = (await productsCol.insertOne({ companyId: manDeId, name: "Lion's City E", createdAt: now })).insertedId;

  const campaignsCol = db.collection('campaigns');
  await campaignsCol.insertMany([
    {
      companyId: bmwHqId,
      name: 'iX Launch Frühjahr 2026',
      productIds: [iX],
      createdAt: now,
    },
    {
      companyId: bmwDeId,
      name: 'SUV Family Q2',
      productIds: [x1, x2, x3],
      createdAt: now,
    },
    {
      companyId: bmwDeId,
      name: 'Kompakt-Duo',
      productIds: [x1, x2],
      createdAt: now,
    },
    {
      companyId: porscheHqId,
      name: 'Sportscar Push',
      productIds: [p911],
      createdAt: now,
    },
    {
      companyId: porscheHqId,
      name: 'SUV Performance',
      productIds: [cayenne, p911],
      createdAt: now,
    },
    {
      companyId: manDeId,
      name: 'E-Mobility Bus 2026',
      productIds: [lionsCity, tgx],
      createdAt: now,
    },
  ]);
}

function tableHtml(title, headers, rows) {
  let h = `<h2 style="font-size:1.1rem;margin:2rem 0 0.5rem">${escapeHtml(title)}</h2><div style="overflow-x:auto"><table><thead><tr>`;
  for (const x of headers) h += `<th>${escapeHtml(x)}</th>`;
  h += '</tr></thead><tbody>';
  for (const row of rows) {
    h += '<tr>';
    for (const cell of row) h += `<td>${cell}</td>`;
    h += '</tr>';
  }
  h += '</tbody></table></div>';
  return h;
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
    const brandRows = brands.map((b) => [
      escapeHtml(b._id.toString()),
      escapeHtml(b.name),
      escapeHtml(b.slug),
    ]);

    const companies = await db
      .collection('companies')
      .aggregate([
        { $sort: { name: 1 } },
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
    const companyRows = companies.map((c) => [
      escapeHtml(c._id.toString()),
      escapeHtml(c.brand.name),
      escapeHtml(c.name),
    ]);

    const products = await db
      .collection('products')
      .aggregate([
        { $sort: { name: 1 } },
        {
          $lookup: {
            from: 'companies',
            localField: 'companyId',
            foreignField: '_id',
            as: 'company',
          },
        },
        { $unwind: '$company' },
        {
          $lookup: {
            from: 'brands',
            localField: 'company.brandId',
            foreignField: '_id',
            as: 'brand',
          },
        },
        { $unwind: '$brand' },
      ])
      .toArray();
    const productRows = products.map((p) => [
      escapeHtml(p._id.toString()),
      escapeHtml(p.brand.name),
      escapeHtml(p.company.name),
      escapeHtml(p.name),
    ]);

    const campaignsAgg = await db
      .collection('campaigns')
      .aggregate([
        { $sort: { name: 1 } },
        {
          $lookup: {
            from: 'companies',
            localField: 'companyId',
            foreignField: '_id',
            as: 'company',
          },
        },
        { $unwind: '$company' },
        {
          $lookup: {
            from: 'brands',
            localField: 'company.brandId',
            foreignField: '_id',
            as: 'brand',
          },
        },
        { $unwind: '$brand' },
      ])
      .toArray();

    const allProductIds = [...new Set(campaignsAgg.flatMap((c) => c.productIds || []).map((id) => id.toString()))];
    const idToName = {};
    if (allProductIds.length) {
      const objs = allProductIds.filter((s) => ObjectId.isValid(s)).map((s) => new ObjectId(s));
      const prods = await db
        .collection('products')
        .find({ _id: { $in: objs } })
        .toArray();
      for (const p of prods) idToName[p._id.toString()] = p.name;
    }

    const campaignRows = campaignsAgg.map((c) => {
      const names = (c.productIds || []).map((pid) => idToName[pid.toString()] || pid.toString()).join(', ');
      return [
        escapeHtml(c._id.toString()),
        escapeHtml(c.brand.name),
        escapeHtml(c.company.name),
        escapeHtml(c.name),
        escapeHtml(names),
      ];
    });

    const css = `body{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#111}table{border-collapse:collapse;width:100%;font-size:0.9rem}th,td{border:1px solid #ccc;padding:0.35rem 0.5rem;text-align:left}th{background:#f4f4f4}code{font-size:0.8rem}`;
    const body =
      tableHtml('Brands', ['_id', 'name', 'slug'], brandRows) +
      tableHtml('Companies', ['_id', 'Brand', 'name'], companyRows) +
      tableHtml('Products', ['_id', 'Brand', 'Company', 'name'], productRows) +
      tableHtml('Campaigns & advertised products', ['_id', 'Brand', 'Company', 'campaign', 'advertised products'], campaignRows);

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Marcom – Datenmodell</title><style>${css}</style></head><body><h1 style="font-size:1.35rem">Marcom Datenkern</h1><p>Collections: <code>brands</code>, <code>companies</code>, <code>products</code>, <code>campaigns</code> (<code>productIds</code> = beworbene Produkte). Musterdaten werden bei leerer DB einmalig eingespielt.</p>${body}</body></html>`;
    res.type('html').send(html);
  } catch (e) {
    res.status(500).type('html').send(`<pre>${escapeHtml(String(e.message || e))}</pre>`);
  }
});

async function main() {
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  const db = await getDb();
  await ensureIndexes(db);
  await seedIfEmpty(db);
  app.listen(port, '0.0.0.0', () => {
    console.log('Listening on ' + port);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
