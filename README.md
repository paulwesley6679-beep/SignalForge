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

v1 passed 3 of 7 cases (results/v1.md, one run per case). It had no way to answer NEEDS_CHECK, and it was wrong on the 502 page (REJECT at 85), on the modern site (QUALIFY at 82/85) and on the intermittent-timeout page (QUALIFY at 82/85). On case 6 its output could not be parsed once, and we do not know why.

v2: to be added after the v2 eval run (results/v2.md).

Failure and recovery on the same broken 502 page, seen in neatlogs: v1 probes the page, calls the model anyway and ends with confidence 95. v2 probes, re-checks, decides in code, makes no model call, and ends with confidence 0 (NEEDS_CHECK / FETCH_FAILED).

## Real sites

Tested separately from the simulated cases. Business names are not listed, so no verdicts are published about real businesses.

- Real site 1: could not be reached from the author's network (timed out twice, 10 seconds each). v2 returned NEEDS_CHECK / FETCH_FAILED, confidence 0, with no model call.
- More real sites: to be added after the v2 eval run.

## Crustdata (tested, optional)

We tested Crustdata for finding businesses. Free account, no card needed. One search for small dental practices in Australia, limited to 10 results, returned 10 companies and every row had a website address. By their names, only about 2 of the 10 looked like dental practices, and one had a .co.uk address. The search cost more than its own estimate (about $1.59 against $0.99). So SignalForge still checks one site at a time, and Crustdata is not a dependency.

## Evidence

- cfo.ai business plan (hypothetical, every input is an assumption): docs/cfo-ai-business-plan.xlsx, an export of the plan.
- Entire checkpoints: commit eb1d33a carries an Entire-Checkpoint trailer from an OpenCode session.
- neatlogs: before and after traces of the 502 page, described under Results.

## Honest limits

- All eval sites are SIMULATED. They are served from localhost and are not real businesses. The 7 cases do not prove accuracy on real websites.
- The model prompt for "outdated site" lists markers (visitor counter, marquee text, fax number, "best viewed in") that our simulated case 4 page contains. Case 4 was written together with the prompt, so a pass there is weaker evidence than the others.
- v2 changed three things at once: the verification policy, code-computed scoring, and hiding the URL from the model. The improvement cannot be credited to one of them alone.
- v1 was run once per case in the eval, and its numbers differ between runs (case 1 scored 20 in a hand run and 15 in the eval run).
- The Gemini free tier allows 20 requests per day for this model, which limited how many runs we could do.
- When no source can be read, v2 reports confidence 0 (the spec's cap of 40 applies when only one source is readable).
- The real-site sample is small.

## Built with

neatlogs (traces), Entire (checkpoints; sessions with Antigravity and then OpenCode), Gemini, plain Node. Crustdata was tested and is optional. The business plan was built in cfo.ai.