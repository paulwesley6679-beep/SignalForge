# SignalForge: spec v0.1

## One line
An autonomous agent that investigates a business, verifies whether it really has a weak online presence, and outputs an opportunity brief. Opportunity and confidence are scored separately.

## Scope (decided)
- Not limited to Nigeria. First test niche: interior-design businesses.
- Stack: Node.js, Gemini API as the model (Bedrock is not available on the hackathon AWS login), neatlogs for traces, Entire for checkpoints, Crustdata for company data once credits arrive.
- No dependency on Agent Orchestrator or AWS.

## Agent loop
1. INPUT: business name + any known URL or social handle.
2. DISCOVER: find website, social profiles, listings (search + Crustdata when available).
3. PROBE: fetch each asset; record status code, response time, redirect chain, timestamp, and one retry on failure.
4. CLAIMS: model proposes problems (e.g. "no working website", "outdated site", "no booking path"). Each claim must cite an evidence record id.
5. VERIFY: apply the verification policy below. Unsupported claims are dropped or marked UNKNOWN.
6. SCORE: opportunity (0-100) and confidence (0-100), computed separately.
7. OUTPUT: opportunity brief (JSON + readable markdown).

## Verification policy
- A fetch failure (timeout, 5xx, DNS error) is evidence of UNKNOWN, never of "no website". Retry once, then re-check after a delay. Only repeated, consistent failure across checks can support a "site is down" claim, and it still caps confidence.
- Every problem claim needs at least one evidence record. No evidence, no claim.
- Confidence is capped at 40 when the key claim rests on a single probe.
- The model may not raise confidence above what the evidence supports.
- Opportunity high + confidence low means "needs human check", not "high opportunity".

## Output shape
```json
{
  "business": "",
  "claims": [{ "text": "", "evidence_ids": [], "status": "CONFIRMED|INFERRED|UNKNOWN" }],
  "evidence": [{ "id": "", "url": "", "status_code": 0, "ms": 0, "checked_at": "" }],
  "opportunity": 0,
  "confidence": 0,
  "recommendation": ""
}
```

## Eval set (7 cases, proposed)
1. Website returns 502 on first probe. v1 wrongly reads it as high opportunity; v2 retries, marks UNKNOWN, caps confidence. This is the demo case.
2. No website, active Instagram with recent posts. Real gap, high confidence.
3. Site loads fine, modern, has booking. Low opportunity.
4. Site loads but is clearly outdated (old copyright year, not mobile-friendly). Medium opportunity, evidence required.
5. Domain parked or expired. High opportunity, confirmed by DNS plus page content.
6. Site only redirects to a Facebook page. Medium opportunity.
7. Slow site (timeouts only on some probes). UNKNOWN, low confidence, recheck.

## Demo plan
Run v1 on case 1, show the neatlogs trace exposing the bad conclusion, add the verification policy, run v2 on all 7 cases, show the before/after table.

## Open questions
- neatlogs integration method (decide after the account exists).
- Submission format and end time (check neatlogs.com/hackathon).
