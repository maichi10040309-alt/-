import express from 'express';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import * as store from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const app = express();
app.use(express.json({ limit: '20mb' }));

// --- SSE: どこかでデータが変更されたら接続中のブラウザ全員に知らせる ---
const sseClients = new Set();

function broadcastChange() {
  for (const res of sseClients) {
    res.write('data: changed\n\n');
  }
}

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();
  res.write('data: connected\n\n');
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

function collectionRoutes(path, collection, listHandler) {
  app.get(`/api/${path}`, listHandler ?? ((req, res) => res.json(collection.list())));
  app.get(`/api/${path}/:id`, (req, res) => {
    const record = collection.get(req.params.id);
    if (!record) return res.status(404).json({ error: 'not_found' });
    res.json(record);
  });
  app.put(`/api/${path}/:id`, (req, res) => {
    const record = collection.put({ ...req.body, id: req.params.id });
    broadcastChange();
    res.json(record);
  });
  app.patch(`/api/${path}/:id`, (req, res) => {
    const record = collection.patch(req.params.id, req.body);
    if (!record) return res.status(404).json({ error: 'not_found' });
    broadcastChange();
    res.json(record);
  });
  app.delete(`/api/${path}/:id`, (req, res) => {
    collection.remove(req.params.id);
    broadcastChange();
    res.json({ ok: true });
  });
  app.post(`/api/${path}/bulk`, (req, res) => {
    const count = collection.bulkPut(req.body);
    broadcastChange();
    res.json({ count });
  });
}

collectionRoutes('customers', store.customers);
collectionRoutes('products', store.products);
// 種別を指定した場合は発行日の新しい順に絞り込んで返す(一覧画面用)
collectionRoutes('documents', store.documents, (req, res) => {
  const { type } = req.query;
  let list = store.documents.list();
  if (type) {
    list = list
      .filter((d) => d.type === type)
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }
  res.json(list);
});

// 得意先/商品は count とコード自動採番を使うため個別に追加
app.get('/api/customers-count', (req, res) => res.json({ count: store.customers.count() }));
app.get('/api/products-count', (req, res) => res.json({ count: store.products.count() }));
app.post('/api/customers/next-code', (req, res) => res.json({ code: store.issueCustomerCode() }));
app.post('/api/products/next-code', (req, res) => res.json({ code: store.issueProductCode() }));

app.get('/api/company', (req, res) => {
  res.json(store.company.get());
});
app.put('/api/company', (req, res) => {
  const record = store.company.put(req.body);
  broadcastChange();
  res.json(record);
});
app.patch('/api/company', (req, res) => {
  const record = store.company.patch(req.body);
  broadcastChange();
  res.json(record);
});

app.post('/api/documents/issue-number', (req, res) => {
  const { type, issueDate } = req.body;
  const number = store.issueDocumentNumber(type, issueDate);
  res.json({ number });
});

app.get('/api/backup', (req, res) => {
  res.json({ ...store.exportAll(), exportedAt: new Date().toISOString() });
});
app.post('/api/restore', (req, res) => {
  store.importAll(req.body);
  broadcastChange();
  res.json({ ok: true });
});

// ビルド済みフロントエンド(dist)を配信する(本番/日常利用モード)
const distDir = join(__dirname, '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('/', (req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
}

function listLanAddresses() {
  const results = [];
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        results.push(iface.address);
      }
    }
  }
  return results;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=== 販売管理ソフト サーバー起動 ===');
  console.log(`このパソコンで開く:   http://localhost:${PORT}/`);
  for (const addr of listLanAddresses()) {
    console.log(`他のパソコンから開く: http://${addr}:${PORT}/`);
  }
  if (!existsSync(distDir)) {
    console.log('');
    console.log('(注意: dist フォルダが見つかりません。先に `npm run build` を実行してください)');
  }
  console.log('');
  console.log('終了するには Ctrl+C を押してください。');
  console.log('');
});
