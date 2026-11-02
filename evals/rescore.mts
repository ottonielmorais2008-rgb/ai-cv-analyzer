// Re-applies the current scoring code and labels to the raw model outputs saved in evals/runs/
// (no new API calls). Usage: npm run eval:rescore
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { scoreCase, summarize, type EvalCase } from "./scoring";

const dir = new URL(".", import.meta.url);
const load = (f: string): EvalCase[] => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
const byId = new Map([...load("dev.json"), ...load("heldout.json")].map((c) => [c.id, c]));
for (const f of readdirSync(new URL("runs/", dir)).filter((f) => f.endsWith(".json"))) {
  const url = new URL(`runs/${f}`, dir);
  const run = JSON.parse(readFileSync(url, "utf8"));
  if (!run.results.every((r: { raw?: { matchScore?: number }; error?: string }) => r.raw?.matchScore !== undefined || r.error)) continue; // older runs without full raw output
  const cases = run.results.map((r: { id: string }) => byId.get(r.id)!);
  run.results = run.results.map((r: { id: string; raw?: unknown; error?: string }) =>
    r.raw ? scoreCase(byId.get(r.id)!, r.raw) : r);
  run.summary = summarize(run.results, cases);
  writeFileSync(url, JSON.stringify(run, null, 2));
  console.log(f, JSON.stringify(run.summary));
}
