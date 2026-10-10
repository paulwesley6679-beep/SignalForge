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

test('200 response with HTML containing a script tag and a title gives a clean body_excerpt without tags', async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Business Homepage</title>
        <style>body { background: #fff; }</style>
        <script>
          function track() { console.log("analytics"); }
        </script>
      </head>
      <body>
        <h1>Welcome to Business</h1>
        <p>Expert interior design services.</p>
      </body>
    </html>
  `;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  try {
    const record = await probe(url);
    assert.strictEqual(record.status_code, 200);
    assert.strictEqual(record.attempts, 1);
    assert.strictEqual(
      record.body_excerpt,
      'Business Homepage Welcome to Business Expert interior design services.'
    );
    assert.ok(!record.body_excerpt.includes('<script>'));
    assert.ok(!record.body_excerpt.includes('track()'));
    assert.ok(!record.body_excerpt.includes('<style>'));
    assert.ok(!record.body_excerpt.includes('background: #fff'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('server that always returns 502 with a body still gives status_code 502 and a non-null body_excerpt', async () => {
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
    assert.notStrictEqual(record.body_excerpt, null);
    assert.strictEqual(record.body_excerpt, 'Bad Gateway');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
