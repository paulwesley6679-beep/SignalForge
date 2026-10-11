// v2_core.mjs - SignalForge v2 decision logic.
// No network and no model calls in this file: the probe and the model are passed in
// (dependency injection), so the logic can be tested offline.
// The model only EXTRACTS findings from page text. Plain code in this file computes
// the opportunity score, the confidence and the verdict (SPEC_v0.2.md).
// All eval fixtures are SIMULATED, not real businesses.

const SOCIAL_HOSTS = ['facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'linkedin.com', 'tiktok.com'];
const MAX_DISCOVERY_CANDIDATES = 2;
const MAX_RECHECKS = 3;

export const THRESHOLDS = { qualifyScore: 60, rejectScore: 30, minConfidence: 50, capWithoutSecondSource: 40 };

const ENUMS = {
  business_active: ['yes', 'no', 'unclear'],
  is_parked_or_expired: ['yes', 'no', 'unclear'],
  site_quality: ['modern', 'outdated', 'unclear'],
  has_booking_or_contact_cta: ['yes', 'no', 'unclear'],
  social_activity: ['active', 'inactive', 'none', 'unclear'],
};

// ---------- small helpers ----------

export function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    url.search = '';
    let s = url.href;
    if (s.endsWith('/') && url.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function isSocialUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (SOCIAL_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return true;
    return url.pathname.includes('/social/'); // fixture convention (simulated social pages)
  } catch {
    return false;
  }
}

export function parseInput(arg) {
  if (!arg) return null;
  const text = String(arg).trim();
  if (text.startsWith('{')) {
    try {
      const o = JSON.parse(text);
      const website = o.website || null;
      const social = o.social || null;
      if (!website && !social) return null;
      return { name: o.name || null, website, social };
    } catch {
      return null;
    }
  }
  if (!normalizeUrl(text)) return null;
  return isSocialUrl(text)
    ? { name: null, website: null, social: text }
    : { name: null, website: text, social: null };
}

// ---------- evidence quality ----------

// clean   = final answer is HTTP 2xx with page text and no failed attempt before it
// flaky   = it worked, but only after a failed attempt (timeout, 5xx, no response)
// failed  = anything else (5xx, 4xx, no response, empty page)
export function classifyProbe(rec) {
  if (!rec) return { state: 'failed', usable: false, why: 'no probe record' };
  const log = Array.isArray(rec.attempt_log) ? rec.attempt_log : [];
  const failedAttempts = log.filter(
    (a) => a.error || a.status_code == null || a.status_code >= 500
  ).length;
  const ok2xx = typeof rec.status_code === 'number' && rec.status_code >= 200 && rec.status_code < 300;
  const hasText = typeof rec.body_excerpt === 'string' && rec.body_excerpt.trim().length > 0;
  if (ok2xx && hasText && failedAttempts === 0) {
    return { state: 'clean', usable: true, why: `HTTP ${rec.status_code}` };
  }
  if (ok2xx && hasText) {
    return { state: 'flaky', usable: false, why: `worked only after ${failedAttempts} failed attempt(s)` };
  }
  if (ok2xx) return { state: 'failed', usable: false, why: 'empty page' };
  return {
    state: 'failed',
    usable: false,
    why: rec.error || (rec.status_code ? `HTTP ${rec.status_code}` : 'no response'),
  };
}

// A source is usable only if its FIRST check was clean. If it was not clean we re-check once:
// if the two checks disagree it is flaky, and a flaky source never counts as evidence.
function settleSource(first, second) {
  if (first.state === 'clean') return { ...first };
  if (!second) return { state: first.state, usable: false, why: first.why };
  if (second.state === 'clean') {
    return { state: 'flaky', usable: false, why: `first check: ${first.why}; re-check: ok (results disagree)` };
  }
  const state = first.state === 'flaky' || second.state === 'flaky' ? 'flaky' : 'failed';
  return { state, usable: false, why: `${first.why}; re-check: ${second.why}` };
}

function needsRecheck(src) {
  if (src.cls.state === 'clean') return false;
  const code = src.rec?.status_code;
  if (typeof code === 'number' && code >= 400 && code < 500) return false; // 4xx is not transient
  return true;
}

function makeSource(label, target, rec, role) {
  const finalUrl = rec?.final_url || null;
  return {
    label,
    role,
    url: target,
    final_url: finalUrl,
    kind: isSocialUrl(finalUrl || target) ? 'social' : 'website',
    evidence_id: rec?.id ?? null,
    rec,
    cls: classifyProbe(rec),
    recheck: null,
    final: null,
  };
}

// ---------- findings ----------

function cleanValue(field, v) {
  if (v === true) v = 'yes';
  if (v === false) v = 'no';
  const s = String(v ?? '').toLowerCase().trim();
  return ENUMS[field].includes(s) ? s : 'unclear';
}

export function normalizeFindings(raw) {
  const out = {};
  for (const field of Object.keys(ENUMS)) out[field] = cleanValue(field, raw?.[field]);
  return out;
}

function mergeField(field, entries) {
  const known = entries.filter((e) => e.value !== 'unclear');
  if (known.length === 0) return { value: 'unclear', support: [], conflict: false };

  if (field === 'has_booking_or_contact_cta') {
    const yes = known.filter((e) => e.value === 'yes');
    if (yes.length) return { value: 'yes', support: yes.map((e) => e.label), conflict: false };
    return { value: 'no', support: known.map((e) => e.label), conflict: false };
  }

  const group = (e) => (field === 'social_activity' && e.value !== 'active' ? 'not_active' : e.value);
  const groups = new Set(known.map(group));
  if (groups.size > 1) {
    return { value: 'conflict', support: known.map((e) => e.label), conflict: true };
  }
  return { value: known[0].value, support: known.map((e) => e.label), conflict: false };
}

// Website pages are judged on site quality and booking; social pages only on activity.
export function aggregateFindings(usableSources, perSource) {
  const collected = {};
  for (const field of Object.keys(ENUMS)) collected[field] = [];

  for (const s of usableSources) {
    const f = normalizeFindings(perSource?.[s.label]);
    collected.business_active.push({ label: s.label, value: f.business_active });
    collected.is_parked_or_expired.push({ label: s.label, value: f.is_parked_or_expired });
    if (s.kind === 'website') {
      collected.site_quality.push({ label: s.label, value: f.site_quality });
      collected.has_booking_or_contact_cta.push({ label: s.label, value: f.has_booking_or_contact_cta });
    } else {
      collected.social_activity.push({ label: s.label, value: f.social_activity });
    }
  }

  const values = {};
  const support = {};
  const conflicts = [];
  for (const field of Object.keys(ENUMS)) {
    const m = mergeField(field, collected[field]);
    values[field] = m.value;
    support[field] = m.support;
    if (m.conflict) conflicts.push(field);
  }
  return { values, support, conflicts };
}

// ---------- scoring and verdict (plain code) ----------

// First matching rule from the top wins (SPEC v0.2.1 patch 2).
export const RULES = [
  { id: 'parked_or_inactive', score: 10, test: (f) => f.findings.is_parked_or_expired === 'yes' || f.findings.business_active === 'no' },
  { id: 'modern_with_cta', score: 20, test: (f) => f.findings.site_quality === 'modern' && f.findings.has_booking_or_contact_cta === 'yes' },
  { id: 'outdated_site', score: 70, test: (f) => f.findings.site_quality === 'outdated' },
  { id: 'no_website_active_social', score: 75, test: (f) => !f.website_provided && f.findings.social_activity === 'active' },
  { id: 'redirects_only_to_social', score: 70, test: (f) => f.redirects_only_to_social },
];
const DEFAULT_RULE = { id: 'default', score: 40 };

export function decide(facts) {
  if (facts.independent_sources === 0) {
    return { opportunity_score: null, confidence: 0, verdict: 'NEEDS_CHECK', reason_code: 'FETCH_FAILED', rule: null };
  }

  const rule = RULES.find((r) => r.test(facts)) || DEFAULT_RULE;
  let confidence = rule.id === 'default' ? 60 : 70;
  if (facts.conflicts.length > 0) confidence = 30;
  if (facts.independent_sources < 2) confidence = Math.min(confidence, THRESHOLDS.capWithoutSecondSource);
  const score = rule.score;

  let verdict;
  let reason_code;
  if (facts.conflicts.length > 0) {
    verdict = 'NEEDS_CHECK';
    reason_code = 'CONFLICT';
  } else if (facts.independent_sources < 2) {
    verdict = 'NEEDS_CHECK';
    reason_code = 'LOW_EVIDENCE';
  } else if (score >= THRESHOLDS.qualifyScore && confidence >= THRESHOLDS.minConfidence) {
    verdict = 'QUALIFY';
    reason_code = 'NONE';
  } else if (score <= THRESHOLDS.rejectScore && confidence >= THRESHOLDS.minConfidence) {
    verdict = 'REJECT';
    reason_code = 'NONE';
  } else {
    verdict = 'NEEDS_CHECK';
    reason_code = 'AMBIGUOUS';
  }
  return { opportunity_score: score, confidence, verdict, reason_code, rule: rule.id };
}

function buildReason(decision, facts, sources) {
  switch (decision.reason_code) {
    case 'FETCH_FAILED': {
      const why = sources.map((s) => `${s.label}: ${s.final.why}`).join(' | ');
      return `No source could be read reliably (${why}). The agent does not judge a business it could not see.`;
    }
    case 'CONFLICT':
      return `Sources disagree on: ${facts.conflicts.join(', ')}. A human should check.`;
    case 'LOW_EVIDENCE':
      return `Only ${facts.independent_sources} independent source could be read, so confidence is capped at ${THRESHOLDS.capWithoutSecondSource} until a second one confirms.`;
    case 'AMBIGUOUS':
      return 'The pages were readable but did not clearly match a scoring rule.';
    default:
      return `Matched rule "${decision.rule}" with ${facts.independent_sources} independent sources agreeing.`;
  }
}

// ---------- the pipeline ----------

export async function runPipeline(input, deps) {
  const probe = deps.probe;
  const recheck = deps.recheck || deps.probe;
  const discover = deps.discover || deps.probe;
  const extractFindings = deps.extractFindings;
  const decideFn = deps.decide || decide;
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const recheckDelayMs = deps.recheckDelayMs ?? 3000;

  // 1. probe the URLs we were given
  const targets = [];
  if (input.website) targets.push(input.website);
  if (input.social) targets.push(input.social);

  const sources = [];
  let n = 0;
  for (const t of targets) {
    n++;
    sources.push(makeSource(`S${n}`, t, await probe(t), 'input'));
  }

  const independentClean = () =>
    new Set(sources.filter((s) => s.cls.state === 'clean').map((s) => normalizeUrl(s.final_url || s.url))).size;

  // 2. discover one extra page from the first clean source if we have fewer than 2 independent sources
  if (independentClean() < 2) {
    const base = sources.find((s) => s.cls.state === 'clean');
    if (base) {
      const known = new Set(sources.map((s) => normalizeUrl(s.final_url || s.url)));
      let origin = null;
      try {
        origin = new URL(base.final_url || base.url).origin;
      } catch {
        origin = null;
      }
      const seen = new Set();
      const candidates = (base.rec.links || []).filter((l) => {
        try {
          const norm = normalizeUrl(l);
          if (!norm || new URL(l).origin !== origin || known.has(norm) || seen.has(norm)) return false;
          seen.add(norm);
          return true;
        } catch {
          return false;
        }
      }).slice(0, MAX_DISCOVERY_CANDIDATES);

      for (const link of candidates) {
        n++;
        const src = makeSource(`S${n}`, link, await discover(link), 'discovered');
        sources.push(src);
        if (src.cls.state === 'clean') break;
      }
    }
  }

  // 3. re-check each source that did not come back clean (once, later)
  let rechecks = 0;
  for (const s of sources) {
    if (needsRecheck(s) && rechecks < MAX_RECHECKS) {
      rechecks++;
      await sleep(recheckDelayMs);
      s.recheck = classifyProbe(await recheck(s.url));
    }
    s.final = settleSource(s.cls, s.recheck);
  }

  const usable = sources.filter((s) => s.final.usable);
  const independent = new Set(usable.map((s) => normalizeUrl(s.final_url || s.url))).size;

  const websiteSrc = input.website ? sources.find((s) => s.role === 'input' && s.url === input.website) : null;
  const redirectsOnlyToSocial = Boolean(
    websiteSrc && websiteSrc.final_url && isSocialUrl(websiteSrc.final_url) && !isSocialUrl(input.website)
  );

  const summary = (s) => ({
    label: s.label,
    role: s.role,
    url: s.url,
    final_url: s.final_url,
    kind: s.kind,
    evidence_id: s.evidence_id,
    state: s.final.state,
    usable: s.final.usable,
    why: s.final.why,
    rechecked: Boolean(s.recheck),
    attempts: s.rec?.attempts ?? null,
    attempt_log: s.rec?.attempt_log ?? null,
  });

  // 4. the model extracts findings (only if there is something usable to read)
  let perSource = {};
  let modelError = null;
  if (usable.length > 0) {
    try {
      perSource = await extractFindings(
        usable.map((s) => ({ label: s.label, kind: s.kind, text: s.rec.body_excerpt, evidence_id: s.evidence_id }))
      );
    } catch (e) {
      modelError = e;
    }
  }

  if (modelError) {
    return {
      input,
      opportunity_score: null,
      confidence: 0,
      verdict: 'NEEDS_CHECK',
      reason_code: 'MODEL_FAILED',
      rule: null,
      reason: `The model could not extract findings (${String(modelError?.message || modelError).slice(0, 160)}). Nothing was scored.`,
      findings: {},
      sources: sources.map(summary),
    };
  }

  // 5. code scores and decides
  const merged = aggregateFindings(usable, perSource);
  const facts = {
    website_provided: Boolean(input.website),
    redirects_only_to_social: redirectsOnlyToSocial,
    findings: merged.values,
    conflicts: merged.conflicts,
    usable_sources: usable.length,
    independent_sources: independent,
  };
  const decision = await decideFn(facts);

  const idByLabel = Object.fromEntries(sources.map((s) => [s.label, s.evidence_id]));
  const findings = {};
  for (const field of Object.keys(ENUMS)) {
    findings[field] = { value: merged.values[field], evidence_ids: merged.support[field].map((l) => idByLabel[l]) };
  }

  return {
    input,
    opportunity_score: decision.opportunity_score,
    confidence: decision.confidence,
    verdict: decision.verdict,
    reason_code: decision.reason_code,
    rule: decision.rule,
    reason: buildReason(decision, facts, sources),
    findings,
    sources: sources.map(summary),
  };
}