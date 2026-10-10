SPEC v0.2 (draft, replaces v0.1 verdict and scoring sections)

1. INPUT
JSON: { "name": string, "website": string?, "social": string? }.
A bare URL on the command line is treated as { "website": URL }.
agent_v1.mjs keeps working unchanged.

2. EVIDENCE
- Evidence record = one probe result (existing probe.js format).
- A SOURCE is a distinct normalized URL (query and fragment removed). Retries of the same URL are the same source.
- A source is USABLE if its final probe returned HTTP 2xx with a body_excerpt.
- A source is FLAKY if its attempts, or a later re-check, disagree (one succeeds, one fails). Flaky sources do not count as usable.
- INDEPENDENT SOURCES = number of distinct usable sources. The fake social page counts as a source.
- A failed fetch (5xx, timeout, DNS error, refused) is never "no website". It means the source is unusable.

3. AGENT LOOP (v2)
input -> probe given URLs -> discover (one extra same-site page linked from the first usable page, or the social URL if given) -> probe it -> re-check each failed source once later -> model extracts findings -> code scores -> output brief.

4. FINDINGS (extracted by the model, nothing else)
- business_active: yes | no | unclear
- is_parked_or_expired: true | false
- site_quality: modern | outdated | unclear
- has_booking_or_contact_cta: true | false
- social_activity: active | inactive | none | unclear
Code (not the model) records: website_provided, redirects_only_to_social (from the redirect chain), sources used.
Every finding must name the evidence record id that supports it. A finding with no evidence id is discarded.

5. SCORING (computed by plain code; numbers are a PROPOSAL, fixed BEFORE running the evals, changes logged)
opportunity_score:
- parked/expired or business_active = no ........ 10
- modern site with booking/contact CTA .......... 20
- outdated site ................................. 70
- no website provided + social active ........... 75
- site only redirects to social ................. 70
- anything else ................................. 40
confidence:
- 70 when 2 or more independent usable sources agree and findings are clear
- 60 when one needed finding is "unclear"
- 30 when sources conflict
- CAP: if independent sources < 2, confidence = min(confidence, 40)

6. VERDICT (code, in this order)
1. No usable source at all -> NEEDS_CHECK, FETCH_FAILED
2. Findings from different sources conflict -> NEEDS_CHECK, CONFLICT
3. Independent sources < 2 -> NEEDS_CHECK, LOW_EVIDENCE
4. score >= 60 and confidence >= 50 -> QUALIFY
5. score <= 30 and confidence >= 50 -> REJECT
6. Otherwise -> NEEDS_CHECK, AMBIGUOUS
reason_code is FETCH_FAILED, CONFLICT, LOW_EVIDENCE or AMBIGUOUS for NEEDS_CHECK, and NONE for QUALIFY and REJECT.
Confidence labels (for reading only; verdicts use the numbers): low <= 40, moderate 50-75, high >= 80. The gaps (41-49, 76-79) have no label.

7. OUTPUT
{ opportunity_score, confidence, verdict, reason_code, findings (each with evidence_id), sources, reason (text) }.

8. EVAL CASES (one pinned verdict each; the eval checks the verdict only)
1 always-502 ................. NEEDS_CHECK (expect FETCH_FAILED, confidence <= 40)
2 no website, active social .. QUALIFY (moderate)
3 modern site with booking ... REJECT
4 outdated site .............. QUALIFY (moderate)
5 parked/expired domain ...... REJECT
6 site only redirects to social page ... QUALIFY (moderate); cut first if time runs short
7 intermittent timeouts ...... NEEDS_CHECK
All fixtures are SIMULATED, served from localhost, and labeled as such in the README and the demo video.
Plan: 2-3 runs per case once the Gemini rate limit is known.