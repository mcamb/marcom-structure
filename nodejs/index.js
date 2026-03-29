const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/api/db-health', async (req, res) => {
  if (!uri) {
    return res.status(500).json({ ok: false, error: 'MONGODB_URI missing' });
  }
  let client;
  try {
    client = new MongoClient(uri);
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    res.json({ ok: true, mongo: 'connected' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  } finally {
    if (client) await client.close().catch(() => {});
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log('Listening on ' + port);
});
