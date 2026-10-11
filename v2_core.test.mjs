// v2_core.test.mjs - offline tests for the v2 decision logic.
// No network, no Gemini: the probe results and the model's findings are scripted.
// Run with: node --test v2_core.test.mjs
// The records mimic the shape probe.js returns. Fixtures are SIMULATED.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInput, normalizeUrl, isSocialUrl, classifyProbe, runPipeline } from './v2_core.mjs';

const B = 'http://127.0.0.1:4010';
let idn = 0;

function rec(url, o = {}) {
  const status = o.status ?? 200;
  const log = o.attempt_log ?? [{ status_code: status, error: o.error ?? null, ms: 20 }];
  return {
    id: `ev-${++idn}`,
    url,
    status_code: status,
    ms: 20,
    redirects: o.redirects ?? [],
    attempts: log.length,
    error: o.error ?? null,
    checked_at: '2026-10-11T00:00:00.000Z',
    body_excerpt: o.text ?? 'Some page text about interiors.',
    final_url: o.final_url ?? url,
    links: o.links ?? [],
    attempt_log: log,
  };
}

// fake probe: for each URL a list of records returned in order (last one repeats)
function fakeProbe(map) {
  const calls = [];
  const counters = {};
  const fn = async (url) => {
    calls.push(url);
    const list = map[url];
    if (!list) return rec(url, { status: 404, text: 'Not Found' });
    counters[url] = (counters[url] ?? -1) + 1;
    return list[Math.min(counters[url], list.length - 1)];
  };
  fn.calls = calls;
  return fn;
}

function fakeModel(byLabelFn) {
  const fn = async (sources) => {
    fn.called = (fn.called || 0) + 1;
    const out = {};
    for (const s of sources) out[s.label] = byLabelFn(s);
    return out;
  };
  return fn;
}

const noSleep = async () => {};

// ---------- small helpers ----------

test('parseInput: bare URL, social URL, JSON, junk', () => {
  assert.deepEqual(parseInput(`${B}/case3/`), { name: null, website: `${B}/case3/`, social: null });
  assert.deepEqual(parseInput(`${B}/case2/social/active`), { name: null, website: null, social: `${B}/case2/social/active` });
  assert.deepEqual(parseInput('https://www.instagram.com/tolu'), { name: null, website: null, social: 'https://www.instagram.com/tolu' });
  assert.deepEqual(parseInput('{"name":"X","website":"http://a.com"}'), { name: 'X', website: 'http://a.com', social: null });
  assert.equal(parseInput('{"name":"X"}'), null);
  assert.equal(parseInput('not a url'), null);
  assert.equal(parseInput(''), null);
});

test('normalizeUrl strips query, hash and trailing slash (not on root)', () => {
  assert.equal(normalizeUrl('http://a.com/x/?q=1#h'), 'http://a.com/x');
  assert.equal(normalizeUrl('http://a.com/'), 'http://a.com/');
  assert.equal(isSocialUrl('https://facebook.com/page'), true);
  assert.equal(isSocialUrl('http://a.com/about'), false);
});

test('classifyProbe: clean, flaky, failed', () => {
  assert.equal(classifyProbe(rec('http://a.com')).state, 'clean');
  const flaky = rec('http://a.com', {
    attempt_log: [{ status_code: null, error: 'timeout', ms: 10000 }, { status_code: 200, error: null, ms: 30 }],
  });
  assert.equal(classifyProbe(flaky).state, 'flaky');
  assert.equal(classifyProbe(rec('http://a.com', { status: 502, error: 'HTTP 502' })).state, 'failed');
  assert.equal(classifyProbe(null).state, 'failed');
});

// ---------- the 7 eval cases ----------

test('case 1 always-502: NEEDS_CHECK / FETCH_FAILED, model never called, source re-checked', async () => {
  const url = `${B}/always-502`;
  const bad = () => rec(url, {
    status: 502, error: 'HTTP 502', text: '502 Bad Gateway',
    attempt_log: [{ status_code: 502, error: 'HTTP 502', ms: 100 }, { status_code: 502, error: 'HTTP 502', ms: 1000 }],
  });
  const probe = fakeProbe({ [url]: [bad(), bad()] });
  const model = fakeModel(() => ({}));
  const r = await runPipeline(parseInput(url), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'NEEDS_CHECK');
  assert.equal(r.reason_code, 'FETCH_FAILED');
  assert.equal(r.opportunity_score, null);
  assert.ok(r.confidence <= 40);
  assert.equal(model.called, undefined);
  assert.equal(probe.calls.filter((u) => u === url).length, 2, 'probed once, re-checked once');
  assert.equal(r.sources[0].rechecked, true);
});

test('case 2 no website, active social: QUALIFY 75 / 70', async () => {
  const s1 = `${B}/case2/social/active`;
  const s2 = `${B}/case2/social/active/posts`;
  const probe = fakeProbe({
    [s1]: [rec(s1, { text: 'Tolu Home Interiors. Bio.', links: [s2] })],
    [s2]: [rec(s2, { text: 'Posted 2 days ago: new living room.' })],
  });
  const model = fakeModel(() => ({ business_active: 'yes', is_parked_or_expired: 'no', social_activity: 'active' }));
  const r = await runPipeline(parseInput(s1), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'QUALIFY');
  assert.equal(r.opportunity_score, 75);
  assert.equal(r.confidence, 70);
  assert.equal(r.rule, 'no_website_active_social');
  assert.equal(r.sources.length, 2);
});

test('case 3 modern site with booking: REJECT 20 / 70', async () => {
  const s1 = `${B}/case3/`;
  const s2 = `${B}/case3/about`;
  const probe = fakeProbe({
    [s1]: [rec(s1, { text: 'Harbor & Pine. Book a consultation.', links: [s2] })],
    [s2]: [rec(s2, { text: 'About our studio.' })],
  });
  const model = fakeModel((s) => ({
    business_active: 'yes', is_parked_or_expired: 'no', site_quality: 'modern',
    has_booking_or_contact_cta: s.label === 'S1' ? 'yes' : 'unclear',
  }));
  const r = await runPipeline(parseInput(s1), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'REJECT');
  assert.equal(r.opportunity_score, 20);
  assert.equal(r.confidence, 70);
});

test('case 4 outdated site: QUALIFY 70 / 70', async () => {
  const s1 = `${B}/case4/`;
  const s2 = `${B}/case4/contact`;
  const probe = fakeProbe({
    [s1]: [rec(s1, { text: 'Adebayo Interiors. Last updated March 2010.', links: [s2] })],
    [s2]: [rec(s2, { text: 'Contact: fax number.' })],
  });
  const model = fakeModel(() => ({
    business_active: 'yes', is_parked_or_expired: 'no', site_quality: 'outdated', has_booking_or_contact_cta: 'no',
  }));
  const r = await runPipeline(parseInput(s1), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'QUALIFY');
  assert.equal(r.opportunity_score, 70);
});

test('case 5 parked domain: REJECT 10 / 70', async () => {
  const s1 = `${B}/case5/`;
  const s2 = `${B}/case5/renew`;
  const probe = fakeProbe({
    [s1]: [rec(s1, { text: 'This domain has expired.', links: [s2] })],
    [s2]: [rec(s2, { text: 'Renew this domain.' })],
  });
  const model = fakeModel(() => ({ business_active: 'no', is_parked_or_expired: 'yes', site_quality: 'unclear' }));
  const r = await runPipeline(parseInput(s1), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'REJECT');
  assert.equal(r.opportunity_score, 10);
});

test('case 6 site only redirects to a social page: QUALIFY 70 / 70', async () => {
  const s1 = `${B}/case6/`;
  const fb = `${B}/case6/social/facebook-page`;
  const posts = `${B}/case6/social/facebook-page/posts`;
  const probe = fakeProbe({
    [s1]: [rec(s1, { final_url: fb, redirects: [fb], text: 'Zainab Decor & Interiors. Bio.', links: [posts] })],
    [posts]: [rec(posts, { text: 'Recent transformations.' })],
  });
  const model = fakeModel(() => ({ business_active: 'yes', is_parked_or_expired: 'no', social_activity: 'active' }));
  const r = await runPipeline(parseInput(s1), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'QUALIFY');
  assert.equal(r.rule, 'redirects_only_to_social');
  assert.equal(r.opportunity_score, 70);
});

test('case 7 intermittent timeouts: NEEDS_CHECK (flaky source never counts)', async () => {
  const url = `${B}/case7/`;
  const flaky = () => rec(url, {
    text: 'Kemi Spaces.',
    attempt_log: [{ status_code: null, error: 'timeout', ms: 10000 }, { status_code: 200, error: null, ms: 30 }],
    links: [`${B}/case7/about`],
  });
  const probe = fakeProbe({ [url]: [flaky(), flaky()] });
  const model = fakeModel(() => ({}));
  const r = await runPipeline(parseInput(url), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'NEEDS_CHECK');
  assert.equal(r.reason_code, 'FETCH_FAILED');
  assert.equal(r.sources[0].state, 'flaky');
  assert.equal(model.called, undefined);
});

// ---------- other paths ----------

test('conflicting sources: NEEDS_CHECK / CONFLICT, confidence 30', async () => {
  const s1 = `${B}/x/`;
  const s2 = `${B}/x/about`;
  const probe = fakeProbe({
    [s1]: [rec(s1, { links: [s2] })],
    [s2]: [rec(s2)],
  });
  const model = fakeModel((s) => ({
    business_active: s.label === 'S1' ? 'yes' : 'no', is_parked_or_expired: 'no', site_quality: 'modern',
  }));
  const r = await runPipeline(parseInput(s1), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'NEEDS_CHECK');
  assert.equal(r.reason_code, 'CONFLICT');
  assert.equal(r.confidence, 30);
});

test('only one readable source: NEEDS_CHECK / LOW_EVIDENCE, confidence capped at 40', async () => {
  const s1 = `${B}/solo/`;
  const probe = fakeProbe({ [s1]: [rec(s1, { links: [] })] });
  const model = fakeModel(() => ({ business_active: 'yes', is_parked_or_expired: 'no', site_quality: 'outdated' }));
  const r = await runPipeline(parseInput(s1), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'NEEDS_CHECK');
  assert.equal(r.reason_code, 'LOW_EVIDENCE');
  assert.ok(r.confidence <= 40);
});

test('model failure: NEEDS_CHECK / MODEL_FAILED, nothing scored', async () => {
  const s1 = `${B}/m/`;
  const s2 = `${B}/m/about`;
  const probe = fakeProbe({ [s1]: [rec(s1, { links: [s2] })], [s2]: [rec(s2)] });
  const model = async () => { throw new Error('429 rate limited'); };
  const r = await runPipeline(parseInput(s1), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'NEEDS_CHECK');
  assert.equal(r.reason_code, 'MODEL_FAILED');
  assert.equal(r.opportunity_score, null);
});

test('garbage from the model becomes "unclear" and lands in AMBIGUOUS, not a guess', async () => {
  const s1 = `${B}/g/`;
  const s2 = `${B}/g/about`;
  const probe = fakeProbe({ [s1]: [rec(s1, { links: [s2] })], [s2]: [rec(s2)] });
  const model = fakeModel(() => ({ business_active: 'maybe', site_quality: 'fancy' }));
  const r = await runPipeline(parseInput(s1), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(r.verdict, 'NEEDS_CHECK');
  assert.equal(r.reason_code, 'AMBIGUOUS');
});

test('a 404 second page is not re-checked and does not count', async () => {
  const s1 = `${B}/n/`;
  const s2 = `${B}/n/missing`;
  const probe = fakeProbe({ [s1]: [rec(s1, { links: [s2] })] }); // s2 -> 404 from fakeProbe
  const model = fakeModel(() => ({ business_active: 'yes', is_parked_or_expired: 'no', site_quality: 'outdated' }));
  const r = await runPipeline(parseInput(s1), { probe, extractFindings: model, sleep: noSleep });
  assert.equal(probe.calls.filter((u) => u === s2).length, 1);
  assert.equal(r.reason_code, 'LOW_EVIDENCE');
});