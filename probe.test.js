const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const probe = require('./probe');

test('retries on 502 and returns 200 on second attempt', async () => {
  let requestCount = 0;
  const server = http.createServer((req, res) => {
    requestCount++;
    if (requestCount === 1) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  try {
    const record = await probe(url);
    assert.strictEqual(record.attempts, 2);
    assert.strictEqual(record.status_code, 200);
    assert.strictEqual(record.error, null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('server that always returns 502 gives status_code 502, attempts 2, and non-null error', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  try {
    const record = await probe(url);
    assert.strictEqual(record.status_code, 502);
    assert.strictEqual(record.attempts, 2);
    assert.notStrictEqual(record.error, null);
    assert.strictEqual(record.error, 'HTTP 502');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
