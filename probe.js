const crypto = require('node:crypto');

const TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 2000;
const MAX_REDIRECTS = 20;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

function formatError(err) {
  if (err.name === 'TimeoutError' || err.name === 'AbortError') {
    return 'timeout';
  }
  if (err.cause && err.cause.code) {
    if (err.cause.code === 'ENOTFOUND') return 'DNS error';
    if (err.cause.code === 'ECONNREFUSED') return 'connection refused';
    return err.cause.code;
  }
  return err.message || String(err);
}

function extractExcerpt(html) {
  if (!html || typeof html !== 'string') return '';
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 4000);
}

function extractLinks(html, finalUrl) {
  if (!html || typeof html !== 'string' || !finalUrl) {
    return [];
  }
  const regex = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  const links = new Set();
  let match;
  while ((match = regex.exec(html)) !== null) {
    const rawHref = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!rawHref || rawHref.startsWith('#')) {
      continue;
    }
    const lower = rawHref.toLowerCase();
    if (lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('javascript:')) {
      continue;
    }
    try {
      const resolved = new URL(rawHref, finalUrl).href;
      links.add(resolved);
      if (links.size >= 20) {
        break;
      }
    } catch (_) {}
  }
  return Array.from(links);
}

async function fetchWithRedirects(targetUrl) {
  let currentUrl = targetUrl;
  const redirects = [];
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  try {
    while (true) {
      if (signal.aborted) {
        throw signal.reason;
      }

      const response = await fetch(currentUrl, {
        signal,
        redirect: 'manual',
      });

      if (REDIRECT_STATUS_CODES.has(response.status)) {
        const location = response.headers.get('location');
        if (location) {
          if (response.body) {
            try {
              await response.body.cancel();
            } catch (_) {}
          }

          if (redirects.length >= MAX_REDIRECTS) {
            throw new Error('Too many redirects');
          }

          const nextUrl = new URL(location, currentUrl).href;
          redirects.push(nextUrl);
          currentUrl = nextUrl;
          continue;
        }
      }

      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch (_) {}
      const body_excerpt = extractExcerpt(bodyText);
      const links = extractLinks(bodyText, currentUrl);

      return {
        status_code: response.status,
        redirects,
        final_url: currentUrl,
        body_excerpt,
        links,
      };
    }
  } catch (err) {
    err.redirects = redirects;
    throw err;
  }
}

async function probe(url) {
  let lastResult = null;
  let lastError = null;
  let attempts = 0;
  let attemptStart = 0;
  const attempt_log = [];

  for (let i = 0; i < 2; i++) {
    attempts++;
    attemptStart = Date.now();
    lastError = null;
    lastResult = null;

    try {
      lastResult = await fetchWithRedirects(url);
    } catch (err) {
      lastError = err;
    }

    const attemptMs = Date.now() - attemptStart;
    const is5xx = lastResult && lastResult.status_code >= 500 && lastResult.status_code < 600;
    const isFailure = Boolean(lastError || is5xx);

    let attemptStatusCode = null;
    let attemptError = null;
    if (lastError) {
      attemptStatusCode = null;
      attemptError = formatError(lastError);
    } else {
      attemptStatusCode = lastResult.status_code;
      attemptError = is5xx ? `HTTP ${lastResult.status_code}` : null;
    }

    attempt_log.push({
      status_code: attemptStatusCode,
      error: attemptError,
      ms: attemptMs,
    });

    if (isFailure && attempts < 2) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      continue;
    }

    break;
  }

  const ms = Date.now() - attemptStart;
  const id = crypto.randomUUID();
  const checked_at = new Date().toISOString();

  if (lastError) {
    return {
      id,
      url,
      status_code: null,
      ms,
      redirects: lastError.redirects || [],
      attempts,
      error: formatError(lastError),
      checked_at,
      body_excerpt: null,
      final_url: null,
      links: [],
      attempt_log,
    };
  }

  const is5xx = lastResult.status_code >= 500 && lastResult.status_code < 600;

  return {
    id,
    url,
    status_code: lastResult.status_code,
    ms,
    redirects: lastResult.redirects,
    attempts,
    error: is5xx ? `HTTP ${lastResult.status_code}` : null,
    checked_at,
    body_excerpt: lastResult.body_excerpt,
    final_url: lastResult.final_url,
    links: lastResult.links,
    attempt_log,
  };
}

module.exports = probe;
module.exports.probe = probe;
module.exports.default = probe;
