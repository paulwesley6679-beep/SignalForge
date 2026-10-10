import { GoogleGenAI } from "@google/genai";
import probe from "./probe.js";

const url = process.argv[2];
if (!url) {
  process.exit(1);
}

const evidence = await probe(url);

const PROMPT = `You help a web design freelancer find businesses with a weak online presence. Based on this evidence, return only JSON with these fields: opportunity_score (0-100), confidence (0-100), verdict (QUALIFY or REJECT), reason (one sentence).

${JSON.stringify(evidence, null, 2)}`;

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({ model: "gemini-3.8-flash", input: PROMPT });

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

const outputText = interaction.output_text;
const cleaned = stripCodeFences(outputText);

try {
  const parsed = JSON.parse(cleaned);
  const result = {
    url,
    evidence,
    ...parsed,
  };
  console.log(JSON.stringify(result, null, 2));
} catch {
  console.log(outputText);
}
