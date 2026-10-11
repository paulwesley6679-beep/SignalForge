// agent_v2.mjs - SignalForge v2.
// The model only EXTRACTS facts from page text. Plain code (v2_core.mjs) verifies the
// sources, computes the score, the confidence and the verdict.
// Usage: node --env-file=.env agent_v2.mjs <url>   (a bare URL, or a JSON object:
//        {"name":"...","website":"...","social":"..."})
// Differences from v1 (list them in the README): verification policy, code-computed
// scoring, and the model is NOT shown the URL. Eval fixtures are SIMULATED.

import { GoogleGenAI } from "@google/genai";
import { init, span, flush, shutdown } from "neatlogs";
import probe from "./probe.js";
import { parseInput, runPipeline, decide } from "./v2_core.mjs";

const MODEL = "gemini-3.8-flash";
const ai = new GoogleGenAI({});

// ---- traced steps (each shows up as a step in the neatlogs trace) ----
const probeSite = span({ kind: "TOOL", toolName: "probe_site" }, async (u) => probe(u));
const discoverPage = span({ kind: "AGENT", name: "discover_second_page" }, async (u) => probeSite(u));
const recheckSource = span({ kind: "GUARDRAIL", name: "recheck_failed_source" }, async (u) => probeSite(u));

const geminiCall = span({ kind: "TOOL", toolName: "gemini_call" }, async (prompt) => {
  const interaction = await ai.interactions.create({ model: MODEL, input: prompt });
  return interaction.output_text;
});

const scoreAndDecide = span({ kind: "CHAIN", name: "score_and_decide" }, async (facts) => decide(facts));

function parseJsonLoose(text) {
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last < first) return null;
  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch {
    return null;
  }
}

function buildPrompt(sources) {
  const today = new Date().toISOString().slice(0, 10);
  const blocks = sources
    .map((s) => `[${s.label}] type: ${s.kind === "social" ? "social page" : "website"}\n"""\n${s.text}\n"""`)
    .join("\n\n");
  return `You extract facts from web page text for a lead-qualification agent. You do NOT judge opportunity and you do NOT give scores. Use only the text provided. Page addresses are not shown on purpose; never guess from names or places.
Today's date is ${today}.

For each source return these fields:
- business_active: "yes" if the text shows the business currently offers services or has recent activity; "no" only if the text says it is closed or defunct, or the page is a parked or expired domain; otherwise "unclear". An old-fashioned design alone is NOT evidence that a business is closed.
- is_parked_or_expired: "yes" if the text says the domain is parked, expired, suspended, for sale or needs renewal; "no" if it is a normal business page; "unclear" if there is too little text.
- site_quality: only for websites. "modern" if the text suggests a current site (clear services, portfolio, online booking, recent dates); "outdated" if it shows old-site markers (copyright or "last updated" years long past, visitor counters, marquee text, fax numbers, "best viewed in" notes); otherwise "unclear". For social pages answer "unclear".
- has_booking_or_contact_cta: only for websites. "yes" if there is a booking or contact call to action (for example "Book a consultation", "Contact us", an enquiry form, a phone number or email to reach the business); "no" if there is none; "unclear" if you cannot tell. For social pages answer "unclear".
- social_activity: only for social pages. "active" if posts are dated within roughly the last 30 days (relative dates like "2 days ago" count); "inactive" if the latest post is older than about 6 months; "none" if no posts are visible; otherwise "unclear". For websites answer "unclear".

If you are not sure about a field, answer "unclear". Return only JSON in exactly this shape, one entry per source:
{"sources":[{"source":"S1","business_active":"...","is_parked_or_expired":"...","site_quality":"...","has_booking_or_contact_cta":"...","social_activity":"..."}]}

Sources:
${blocks}`;
}

const extractFindings = span({ kind: "AGENT", name: "extract_findings" }, async (sources) => {
  const prompt = buildPrompt(sources);
  const waits = [0, 6000, 20000]; // retry on rate limits or bad output
  let lastError = null;
  for (const wait of waits) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const text = await geminiCall(prompt);
      const parsed = parseJsonLoose(text);
      if (parsed && Array.isArray(parsed.sources)) {
        const out = {};
        for (const item of parsed.sources) {
          if (item && item.source) out[String(item.source)] = item;
        }
        return out;
      }
      lastError = new Error("model reply was not the expected JSON");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
});

const run = span({ kind: "WORKFLOW", name: "agent_v2_run" }, async (input) =>
  runPipeline(input, {
    probe: probeSite,
    discover: discoverPage,
    recheck: recheckSource,
    extractFindings,
    decide: scoreAndDecide,
  })
);

async function main() {
  const input = parseInput(process.argv[2]);
  if (!input) {
    console.error('Usage: node --env-file=.env agent_v2.mjs <url> or \'{"name":"...","website":"...","social":"..."}\'');
    process.exit(1);
  }

  await init({ apiKey: process.env.NEATLOGS_API_KEY, workflowName: "signalforge" });
  try {
    const result = await run(input);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await flush();
    await shutdown();
  }
}

await main();