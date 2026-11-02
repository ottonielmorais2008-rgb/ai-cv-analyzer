// Usage: npm run eval -- [dev|heldout|all] [--label name]
// Needs GOOGLE_GENERATIVE_AI_API_KEY (or AI_GATEWAY_API_KEY) in the environment.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { analyzeCv, getModel } from "../lib/analyze";
import { scoreCase, summarize, type CaseResult, type EvalCase } from "./scoring";

const args = process.argv.slice(2);
const split = args.find((a) => !a.startsWith("--")) ?? "dev";
const label = args.includes("--label") ? args[args.indexOf("--label") + 1] : "run";
const delayMs = Number(process.env.EVAL_DELAY_MS ?? 4500); // stay under free-tier rate limits
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dir = new URL(".", import.meta.url);
const load = (f: string): EvalCase[] => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
const cases = split === "all" ? [...load("dev.json"), ...load("heldout.json")] : load(`${split}.json`);

const results: CaseResult[] = [];
for (const c of cases) {
  let r: CaseResult;
  try {
    r = scoreCase(c, await analyzeCv(c.cv, c.job));
  } catch (e) {
    r = { ...scoreCase(c, null), error: e instanceof Error ? e.message.slice(0, 120) : "error" };
  }
  results.push(r);
  console.log(`${r.id}: score=${r.score} inRange=${r.scoreInRange} missing=${r.missingFound}/${r.missingTotal}` +
    (r.falseGaps.length ? ` falseGaps=${r.falseGaps.join(",")}` : "") +
    (r.ungroundedGaps.length ? ` ungrounded=${r.ungroundedGaps.join("|")}` : "") +
    (r.contradictions.length ? ` contradictions=${r.contradictions.join("|")}` : "") +
    (r.splitAlternatives.length ? ` splitOR=${r.splitAlternatives.join("|")}` : "") + (r.error ? ` error=${r.error}` : ""));
  await sleep(delayMs);
}

const s = summarize(results, cases);
console.log(JSON.stringify(s));
const runsDir = new URL("runs/", dir);
if (!existsSync(runsDir)) mkdirSync(runsDir);
writeFileSync(new URL(`runs/${label}-${split}.json`, dir),
  JSON.stringify({ label, split, model: getModel().modelId, date: new Date().toISOString(), summary: s, results }, null, 2));
