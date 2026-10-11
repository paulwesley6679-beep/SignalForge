# SignalForge

SignalForge is an agent that investigates a business's online presence, checks whether its weakness is real, and writes an opportunity brief. It scores opportunity and confidence separately, so a weak result can say "I am not sure" instead of guessing. Built for neatHack 2026. First test niche: interior design.

## The problem it shows

A naive agent (v1) probes a website and asks a model for a verdict. When the site returns a 502 error, v1 still gave a firm REJECT with confidence 85, in two separate runs, even though the page gave it no real information about the business. It is confidently wrong about a site it could not see. v1's code has no verification step at all (agent_v1.mjs).

## What v2 does differently

- The model only extracts facts from page text (is the business active, is the site old or modern, is there a booking button, are the social posts recent). It never sees the URL and never gives a score.
- Plain code verifies the sources and computes the score, the confidence and the verdict.
- A fetch failure is never "no website". A failed source is re-checked later, and a source that only works after a failed attempt counts as flaky and is not used as evidence.
- A QUALIFY or REJECT verdict needs two independent sources (two different pages). With less evidence the verdict is NEEDS_CHECK, with a reason code (FETCH_FAILED, LOW_EVIDENCE, CONFLICT, AMBIGUOUS or MODEL_FAILED).

The full rules are in SPEC_v0.2.md.

## How to run it

    node fixtures/server.js                              (start the simulated sites)
    node --env-file=.env agent_v2.mjs http://127.0.0.1:4010/case3/
    node eval.mjs agent_v2.mjs                           (run the 7 eval cases)

You need Node and a Gemini API key in a local .env file (not committed).

## Results

v1 passed 3 of 7 cases (results/v1.md, one run per case). It had no way to answer NEEDS_CHECK, and it was wrong on the 502 page (REJECT at 85), on the modern site (QUALIFY at 82/85) and on the intermittent-timeout page (QUALIFY at 82/85). On case 6 its output could not be parsed once, and we do not know why.

v2: to be added after the v2 eval run (results/v2.md).

## Honest limits

- All eval sites are SIMULATED. They are served from localhost and are not real businesses. The 7 cases do not prove accuracy on real websites.
- The model prompt for "outdated site" lists markers (visitor counter, marquee text, fax number, "best viewed in") that our simulated case 4 page contains. Case 4 was written together with the prompt, so a pass there is weaker evidence than the others.
- v2 changed three things at once: the verification policy, code-computed scoring, and hiding the URL from the model. The improvement cannot be credited to one of them alone.
- v1 was run once per case in the eval, and its numbers differ between runs (case 1 scored 20 in a hand run and 15 in the eval run).
- The Gemini free tier allows 20 requests per day for this model, which limited how many runs we could do.
- When no source can be read, v2 reports confidence 0 (the spec's cap of 40 applies when only one source is readable).
- Real-business tests are listed separately from the simulated cases.

## Built with

neatlogs (traces), Entire (checkpoints; sessions with Antigravity and then OpenCode), Gemini, plain Node. cfo.ai business plan: to be added.