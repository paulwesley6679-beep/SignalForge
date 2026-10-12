# SignalForge

SignalForge is an agent that investigates a business's online presence, checks whether its weakness is real, and writes an opportunity brief. It scores opportunity and confidence separately, so a weak result can say "I am not sure" instead of guessing. Built for neatHack 2026. First test niche: interior design (the agent itself is not tied to one niche).

## The problem it shows

A naive agent (v1) probes a website and asks a model for a verdict. When the site returns a 502 error, v1 still gave a firm REJECT, with confidence between 85 and 95 across runs (two neatlogs traces of the same page show 95 and 85). It is confidently wrong about a site it could not see. v1's code has no verification step at all (agent_v1.mjs).

## What v2 does differently

- The model only extracts facts from page text (is the business active, is the site old or modern, is there a booking button, are the social posts recent). It never sees the URL and never gives a score.
- Plain code verifies the sources and computes the score, the confidence and the verdict.
- A fetch failure is never "no website". A failed source is re-checked, and a source that only works after a failed attempt counts as flaky and is not used as evidence.
- A QUALIFY or REJECT verdict needs two independent sources (two different pages). With less evidence the verdict is NEEDS_CHECK, with a reason code (FETCH_FAILED, LOW_EVIDENCE, CONFLICT, AMBIGUOUS or MODEL_FAILED).
- If the model's daily quota is used up, v2 is designed to stop after one try instead of retrying (not yet seen against a real daily limit).

The full rules are in SPEC_v0.2.md.

## How to run it

    node fixtures/server.js                              (start the simulated sites)
    node --env-file=.env agent_v2.mjs http://127.0.0.1:4010/case3/
    node eval.mjs agent_v2.mjs                           (run the 7 eval cases)
    node ui.mjs                                          (local demo page at http://127.0.0.1:4020/)

You need Node and a Gemini API key in a local .env file (not committed). The demo page only runs the same agent_v2.mjs; it is not a second agent.

## Results

Simulated eval (7 cases, one run per case):

| Agent | Passed |
| ----- | ------ |
| v1 (naive) | 3 of 7 (results/v1.md) |
| v2 | 6 of 7 (results/v2.md) |

v1 had no way to answer NEEDS_CHECK, and it was wrong on the 502 page (REJECT at 85), on the modern site (QUALIFY at 82/85) and on the intermittent-timeout page (QUALIFY at 82/85). On case 6 its output could not be parsed once, and we do not know why.

v2 passed cases 1 to 5 and 7. It failed case 6 (a site that only redirects to a social page): it expected QUALIFY and returned NEEDS_CHECK with reason CONFLICT on social activity (score 70, confidence 30). Our best explanation, not verified, is that the profile page shows no post dates, so the model read it differently from the posts page. We did not change the fixture, the prompt or the rules to make it pass.

Failure and recovery on the same broken 502 page, seen in neatlogs: v1 probes the page, calls the model anyway and ends with confidence 95. v2 probes, re-checks, decides in code, makes no model call, and ends with confidence 0 (NEEDS_CHECK / FETCH_FAILED).

## Real sites

Tested separately from the simulated cases, with one run each. Business names are not listed, so no verdicts are published about real businesses.

- Real site 1: could not be reached from the author's network (timed out twice, 10 seconds each). v2 returned NEEDS_CHECK / FETCH_FAILED, confidence 0, with no model call.
- Real site 2: a working interior design site. v2 read two pages that agreed and returned REJECT, score 20, confidence 70.
- Real site 3: a "coming soon" placeholder page. v2 could read only one page, so it returned NEEDS_CHECK / LOW_EVIDENCE, confidence 40. A site with a single page can never reach QUALIFY or REJECT under the two-source rule, which is a limitation.

Three sites show the pipeline runs on real pages. They do not measure accuracy.

## Crustdata (tested, optional)

We tested Crustdata for finding businesses. Free account, no card needed. One search for small dental practices in Australia, limited to 10 results, returned 10 companies and every row had a website address. By their names, only about 2 of the 10 looked like dental practices, and one had a .co.uk address. The search cost more than its own estimate (about $1.59 against $0.99). So SignalForge still checks one site at a time, and Crustdata is not a dependency.

## Evidence

- Eval results: results/v1.md and results/v2.md (with the JSON files beside them).
- cfo.ai business plan (hypothetical, every input is an assumption): docs/cfo-ai-business-plan.xlsx, an export of the plan. The shared cfo.ai link opens without a login, but on Monday morning the Summary page's key-results block showed a render error in the logged-out view.
- Entire checkpoints: commit eb1d33a carries an Entire-Checkpoint trailer from an OpenCode session.
- neatlogs: before and after traces of the 502 page, described under Results.

## Honest limits

- All eval sites are SIMULATED. They are served from localhost and are not real businesses. The 7 cases do not prove accuracy on real websites.
- Cases 1 and 7 never call the model, so they test the verification code, not the model.
- The model prompt for "outdated site" lists markers (visitor counter, marquee text, fax number, "best viewed in") that our simulated case 4 page contains. Case 4 was written together with the prompt, so a pass there is weaker evidence than the others.
- v2 changed three things at once: the verification policy, code-computed scoring, and hiding the URL from the model. The improvement cannot be credited to one of them alone.
- Each eval case was run once, so run-to-run variation in v2 is not measured. v1's numbers did differ between runs (case 1 scored 20 in a hand run and 15 in the eval run).
- v2 failed case 6 (see Results). A page that shows no post dates can disagree with a page that does, and the code treats that as a conflict.
- The Gemini free tier allows 20 requests per day for this model, which limited how many runs we could do.
- When no source can be read, v2 reports confidence 0 (the spec's cap of 40 applies when only one source is readable).
- The real-site sample is small (three sites).

## Built with

neatlogs (traces), Entire (checkpoints; sessions with Antigravity and then OpenCode), Gemini, plain Node. Crustdata was tested and is optional. The business plan was built in cfo.ai.