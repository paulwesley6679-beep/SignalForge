const http = require('http');

const PORT = 4010;

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:4010'}`);

  if (req.method === 'GET' && parsedUrl.pathname === '/ok') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lumina Studio | Modern Interior Design</title>
</head>
<body>
  <h1>Lumina Modern Interior Design Studio</h1>
  <p>We craft refined, contemporary residential and commercial interiors that seamlessly balance elegant aesthetics with practical functionality.</p>
  <p>Our comprehensive services include spatial planning, bespoke furniture design, custom lighting architecture, and curated material sourcing.</p>
  <p>From initial concept sketches to turnkey styling, our dedicated designers collaborate closely with you to bring your vision to life.</p>
  <button type="button">Book a consultation</button>
</body>
</html>`);
    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/always-502') {
    res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>502 Bad Gateway</title>
</head>
<body>
  <h1>502 Bad Gateway</h1>
  <p>The server encountered a temporary error and could not complete your request.</p>
</body>
</html>`);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

module.exports = server;
