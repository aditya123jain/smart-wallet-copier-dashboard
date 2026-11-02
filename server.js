'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.INGEST_TOKEN || '';
const SNAP_FILE = path.join(process.env.TMPDIR || '/tmp', 'swc_snapshot.json');
const INDEX = path.join(__dirname, 'public', 'index.html');
const MAX_BODY = 4 * 1024 * 1024;

let snapshot = null;
try { snapshot = JSON.parse(fs.readFileSync(SNAP_FILE, 'utf8')); } catch (_) {}

function safeEq(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
};

function send(res, code, body, type) {
  res.writeHead(code, Object.assign({ 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, SEC));
  res.end(body);
}

http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    return fs.readFile(INDEX, (e, d) => e ? send(res, 500, 'error', 'text/plain') : send(res, 200, d, 'text/html; charset=utf-8'));
  }
  if (req.method === 'GET' && url === '/api/snapshot') {
    return send(res, 200, JSON.stringify(snapshot || { empty: true }));
  }
  if (req.method === 'GET' && url === '/healthz') return send(res, 200, '{"ok":true}');
  if (req.method === 'POST' && url === '/api/ingest') {
    if (!TOKEN) return send(res, 503, '{"error":"ingest disabled"}');
    const m = /^Bearer (.+)$/.exec(req.headers['authorization'] || '');
    if (!m || !safeEq(m[1], TOKEN)) return send(res, 401, '{"error":"unauthorized"}');
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { send(res, 413, '{"error":"too large"}'); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      try {
        const obj = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('bad');
        obj.received_at = new Date().toISOString();
        snapshot = obj;
        fs.writeFile(SNAP_FILE, JSON.stringify(obj), () => {});
        send(res, 200, '{"ok":true}');
      } catch (_) { send(res, 400, '{"error":"invalid json"}'); }
    });
    return;
  }
  send(res, 404, '{"error":"not found"}');
}).listen(PORT, () => console.log('listening on ' + PORT));
