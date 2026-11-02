import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreCase, summarize, mentions, type EvalCase } from "../evals/scoring";
import { validateInput } from "../lib/analyze";
import { analysisSchema } from "../app/schema";

const load = (f: string): EvalCase[] => JSON.parse(readFileSync(new URL(`../evals/${f}`, import.meta.url), "utf8"));

test("datasets are well formed and inputs pass validation", () => {
  const all = [...load("dev.json"), ...load("heldout.json")];
  assert.ok(all.length >= 20 && all.length <= 30);
  assert.equal(new Set(all.map((c) => c.id)).size, all.length);
  for (const c of all) {
    assert.ok(validateInput(c).ok, `${c.id} fails input validation`);
    const [lo, hi] = c.expected.scoreRange;
    assert.ok(lo >= 0 && hi <= 100 && lo <= hi, `${c.id} bad range`);
  }
});

test("input validation rejects short and oversized texts", () => {
  assert.equal(validateInput({ cv: "short", job: "short" }).ok, false);
  const r = validateInput({ cv: "x".repeat(9000), job: "y".repeat(100) });
  assert.ok(!r.ok && r.status === 413);
});

test("schema rejects out-of-range scores", () => {
  const bad = { matchScore: 140, matchedSkills: [], missingSkills: [], suggestions: ["a", "b", "c"] };
  assert.equal(analysisSchema.safeParse(bad).success, false);
});

test("scoring with a mock model response", () => {
  const c: EvalCase = {
    id: "mock", cv: "", job: "",
    expected: { scoreRange: [40, 70], mustMissing: [["Docker"], ["PostgreSQL", "Postgres"]], mustNotMissing: [["React"]] },
  };
  const mock = { matchScore: 55, matchedSkills: ["React"], missingSkills: ["Docker containers", "Kubernetes"], suggestions: ["a", "b", "c"] };
  const r = scoreCase(c, mock);
  assert.equal(r.schemaValid, true);
  assert.equal(r.scoreInRange, true);
  assert.equal(r.missingFound, 1);
  assert.deepEqual(r.missedSkills, ["PostgreSQL"]);
  assert.deepEqual(r.falseGaps, []);
  assert.equal(summarize([r]).missingRecall, 50);
  assert.equal(scoreCase(c, { nope: true }).schemaValid, false);
  assert.ok(mentions(["CI/CD (GitHub Actions)"], ["GitHub Actions"]));
});

test("gap grounding and contradictions", () => {
  const c: EvalCase = { id: "g", cv: "", job: "Requirements: Docker, PostgreSQL, CI/CD pipelines.", expected: { scoreRange: [0, 100], mustMissing: [], mustNotMissing: [] } };
  const r = scoreCase(c, { matchScore: 50, matchedSkills: ["Docker"], missingSkills: ["Docker", "PostgreSQL databases", "Kubernetes"], suggestions: ["a", "b", "c"] });
  assert.deepEqual(r.ungroundedGaps, ["Kubernetes"]);
  assert.deepEqual(r.contradictions, ["Docker"]);
});

test("short aliases match whole words only", () => {
  assert.equal(mentions(["Device drivers"], ["C"]), false);
  assert.equal(mentions(["C", "Rust"], ["C"]), true);
  assert.equal(mentions(["Go or Python"], ["Go"]), true);
});
