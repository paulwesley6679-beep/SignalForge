import { GoogleGenAI } from "@google/genai";
import { init, span, flush, shutdown } from "neatlogs";
import probe from "./probe.js";

const ai = new GoogleGenAI({});

const probe_site = span({ kind: "TOOL", toolName: "probe_site" }, async (u) => probe(u));

const gemini_call = span({ kind: "TOOL", toolName: "gemini_call" }, async (prompt) => {
  const interaction = await ai.interactions.create({ model: "gemini-3.8-flash", input: prompt });
  return interaction.output_text;
});

function stripCodeFences(text) {
  if (!text) return "";
  let trimmed = text.trim();
  const fullMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullMatch) {
    return fullMatch[1].trim();
  }
  const embeddedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (embeddedMatch) {
    return embeddedMatch[1].trim();
  }
  return trimmed;
}

const agent_v1_run = span({ kind: "WORKFLOW", name: "agent_v1_run" }, async (url) => {
  const evidence = await probe_site(url);

  const PROMPT = `You help a web design freelancer find businesses with a weak online presence. Based on this evidence, return only JSON with these fields: opportunity_score (0-100), confidence (0-100), verdict (QUALIFY or REJECT), reason (one sentence).

${JSON.stringify(evidence, null, 2)}`;

  const outputText = await gemini_call(PROMPT);
  const cleaned = stripCodeFences(outputText);

  try {
    const parsed = JSON.parse(cleaned);
    const result = {
      url,
      evidence,
      ...parsed,
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch {
    console.log(outputText);
  }
});

async function main() {
  await init({ apiKey: process.env.NEATLOGS_API_KEY, workflowName: "signalforge" });

  const url = process.argv[2];
  if (!url) {
    process.exit(1);
  }

  try {
    await agent_v1_run(url);
  } finally {
    await flush();
    await shutdown();
  }
}

await main();
