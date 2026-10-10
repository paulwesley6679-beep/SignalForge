// SIMULATED FIXTURES for SignalForge evals. Not real businesses.

const http = require('http');

const PORT = 4010;

let case7HomeCount = 0;
let case7AboutCount = 0;
const pendingTimeouts = new Set();

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1:4010'}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'GET' && pathname === '/ok') {
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

  if (req.method === 'GET' && pathname === '/always-502') {
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

  // Case 3: Contemporary site with booking
  if (req.method === 'GET' && (pathname === '/case3/' || pathname === '/case3')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Harbor &amp; Pine Interiors</title>
</head>
<body>
  <h1>Harbor &amp; Pine Interiors</h1>
  <p>Harbor &amp; Pine Interiors is a full-service interior architecture and design firm. We create bespoke residential and commercial spaces defined by clean lines, natural textures, and timeless craftsmanship.</p>
  <p>Our services include comprehensive spatial planning, custom cabinetry design, architectural lighting, material selection, and complete project management from concept to completion.</p>
  <p><a href="/case3/about">About Our Studio</a></p>
  <button type="button">Book a consultation</button>
</body>
</html>`);
    return;
  }

  if (req.method === 'GET' && pathname === '/case3/about') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>About Our Studio | Harbor &amp; Pine Interiors</title>
</head>
<body>
  <h1>About Harbor &amp; Pine Interiors</h1>
  <p>Founded by principal designers dedicated to spatial harmony, our team brings over fifteen years of combined expertise in high-end interior architecture and residential transformations.</p>
  <p>Our collaborative design process begins with in-depth discovery sessions, followed by detailed 3D renderings, meticulous procurement, and white-glove styling on delivery day.</p>
  <p><a href="/case3/">Return to Home</a></p>
  <button type="button">Book a consultation</button>
</body>
</html>`);
    return;
  }

  // Case 4: Old-style site, no booking
  if (req.method === 'GET' && (pathname === '/case4/' || pathname === '/case4')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Adebayo Interiors - Welcome to our homepage</title>
</head>
<body bgcolor="#FFFFCC" text="#000080">
  <marquee>Welcome to Adebayo Interiors - Quality Furniture and Curtains Since 1998!</marquee>
  <table width="750" border="1" cellpadding="10" align="center">
    <tr>
      <td align="center">
        <h1>Adebayo Interiors</h1>
        <p>We provide residential living room decoration, office blinds, and upholstery services across the city.</p>
        <p>Please call our office or send a fax for all inquiries and price quotations.</p>
        <p><a href="/case4/contact">Click here for Contact Information</a></p>
        <hr>
        <p>Visitors: 004521</p>
        <p>&copy; 2009 Adebayo Interiors. All rights reserved.</p>
        <p>Best viewed in Internet Explorer 6 at 800x600</p>
      </td>
    </tr>
  </table>
</body>
</html>`);
    return;
  }

  if (req.method === 'GET' && pathname === '/case4/contact') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Adebayo Interiors - Contact Us</title>
</head>
<body bgcolor="#FFFFCC" text="#000080">
  <table width="750" border="1" cellpadding="10" align="center">
    <tr>
      <td>
        <h2>Contact Adebayo Interiors</h2>
        <p>Address: 14 Commercial Avenue, Suite 3, Lagos</p>
        <p>Phone: +234-1-555-0192</p>
        <p>Fax: +234-1-555-0193</p>
        <p><a href="/case4/">Back to Main Page</a></p>
        <hr>
        <p>Last updated March 2010</p>
      </td>
    </tr>
  </table>
</body>
</html>`);
    return;
  }

  // Case 5: Parked or expired domain
  if (req.method === 'GET' && (pathname === '/case5/' || pathname === '/case5')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Domain Expired</title>
</head>
<body>
  <h1>This domain has expired</h1>
  <p>The domain registration has lapsed and is pending renewal or release.</p>
  <p>Renew this domain or make an offer to buy it.</p>
  <p><a href="/case5/renew">Domain Renewal and Purchase Options</a></p>
</body>
</html>`);
    return;
  }

  if (req.method === 'GET' && pathname === '/case5/renew') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Domain Renewal Services</title>
</head>
<body>
  <h1>Domain Renewal and Marketplace</h1>
  <p>If you are the registrant of this domain, you can log in to your registrar account to complete the renewal process. Alternatively, prospective buyers may submit an acquisition offer through our domain brokerage service.</p>
  <p><a href="/case5/">Back to Domain Notice</a></p>
</body>
</html>`);
    return;
  }

  // Case 2: No website, active social page
  if (req.method === 'GET' && pathname === '/case2/social/active') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Tolu Home Interiors (@toluhomeinteriors)</title>
</head>
<body>
  <h1>Tolu Home Interiors</h1>
  <p>Bio: Residential interior stylist specializing in warm minimalism and custom soft furnishings. DM for project inquiries.</p>
  <p>Latest post: posted 2 days ago</p>
  <p>Completed a warm serene master bedroom makeover featuring handcrafted fluted wood panels and linen drapery.</p>
  <p><a href="/case2/social/active/posts">View all posts</a></p>
</body>
</html>`);
    return;
  }

  if (req.method === 'GET' && pathname === '/case2/social/active/posts') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Posts by Tolu Home Interiors</title>
</head>
<body>
  <h1>Tolu Home Interiors - Recent Posts</h1>
  <ul>
    <li>
      <p>Master bedroom sanctuary finished with fluted oak and custom linen.</p>
      <small>posted 2 days ago</small>
    </li>
    <li>
      <p>Dining room styling session featuring hand-thrown ceramic centerpieces.</p>
      <small>posted 1 week ago</small>
    </li>
    <li>
      <p>Full living area reveal: neutral palettes and textured boucl&eacute; seating.</p>
      <small>posted 3 weeks ago</small>
    </li>
  </ul>
  <p><a href="/case2/social/active">Back to Profile</a></p>
</body>
</html>`);
    return;
  }

  // Case 6: Site redirects to social page
  if (req.method === 'GET' && (pathname === '/case6/' || pathname === '/case6')) {
    res.writeHead(302, { Location: '/case6/social/facebook-page' });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/case6/social/facebook-page') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Zainab Decor &amp; Interiors - Home</title>
</head>
<body>
  <h1>Zainab Decor &amp; Interiors</h1>
  <p>Bio: Creative interior decorator and space planner creating joyful, functional family homes across Abuja and Lagos.</p>
  <p>Check out our recent transformations: kitchen island redesign, cozy reading nook, and balcony garden lounge.</p>
  <p><a href="/case6/social/facebook-page/posts">See Page Posts</a></p>
</body>
</html>`);
    return;
  }

  if (req.method === 'GET' && pathname === '/case6/social/facebook-page/posts') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Zainab Decor &amp; Interiors - Posts</title>
</head>
<body>
  <h1>Posts - Zainab Decor &amp; Interiors</h1>
  <ul>
    <li>
      <p>Kitchen island overhaul with quartz countertops and pendant lighting.</p>
      <small>posted 3 days ago</small>
    </li>
    <li>
      <p>Cozy reading nook tucked under the stairway with custom shelving.</p>
      <small>posted 2 weeks ago</small>
    </li>
    <li>
      <p>Balcony lounge completed just in time for the sunny season.</p>
      <small>posted 1 month ago</small>
    </li>
  </ul>
  <p><a href="/case6/social/facebook-page">Back to Profile</a></p>
</body>
</html>`);
    return;
  }

  // Case 7: Intermittent timeouts
  if (req.method === 'GET' && (pathname === '/case7/' || pathname === '/case7')) {
    case7HomeCount++;
    if (case7HomeCount % 2 === 1) {
      pendingTimeouts.add(res);
      req.on('close', () => {
        pendingTimeouts.delete(res);
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kemi Spaces - Interior Architecture</title>
</head>
<body>
  <h1>Kemi Spaces</h1>
  <p>Kemi Spaces specializes in residential and corporate interior architecture. We create balanced, welcoming spaces rooted in thoughtful ergonomics and organic materials.</p>
  <p>Our work spans private residences, boutique studios, and creative workspaces across the metropolitan area.</p>
  <p><a href="/case7/about">About Kemi Spaces</a></p>
  <button type="button">Book a consultation</button>
</body>
</html>`);
    return;
  }

  if (req.method === 'GET' && pathname === '/case7/about') {
    case7AboutCount++;
    if (case7AboutCount % 2 === 1) {
      pendingTimeouts.add(res);
      req.on('close', () => {
        pendingTimeouts.delete(res);
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>About Us - Kemi Spaces</title>
</head>
<body>
  <h1>About Kemi Spaces</h1>
  <p>Founded by lead architectural consultant Kemi Adeleke, our studio is committed to crafting environments that promote tranquility and productivity.</p>
  <p>We provide full concept design, structural renovation oversight, bespoke cabinetry, and tailored lighting schemes.</p>
  <p><a href="/case7/">Return to Home</a></p>
  <button type="button">Book a consultation</button>
</body>
</html>`);
    return;
  }

  // Reset counters for Case 7
  if (req.method === 'GET' && pathname === '/__reset') {
    case7HomeCount = 0;
    case7AboutCount = 0;
    for (const hangingRes of pendingTimeouts) {
      try {
        hangingRes.destroy();
      } catch (_) {}
    }
    pendingTimeouts.clear();
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${PORT}/`);
});

module.exports = server;
