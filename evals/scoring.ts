import { analysisSchema } from "../app/schema";

export type EvalCase = {
  id: string;
  cv: string;
  job: string;
  expected: {
    scoreRange: [number, number];
    /** Each entry is a list of accepted aliases for one skill the model must flag as missing. */
    mustMissing: string[][];
    /** Skills the CV clearly has; flagging them as missing is a false gap. */
    mustNotMissing: string[][];
    /** "X or Y" requirement groups: the model should list at most one gap per group. */
    alternatives?: string[][];
  };
};

export type CaseResult = {
  id: string;
  schemaValid: boolean;
  score: number | null;
  scoreInRange: boolean;
  missingFound: number;
  missingTotal: number;
  falseGaps: string[];
  missedSkills: string[];
  /** Reported missing skills that do not appear anywhere in the job description. */
  ungroundedGaps: string[];
  /** Skills listed both as matched and as missing. */
  contradictions: string[];
  reportedGaps: number;
  /** Alternative groups that were split into several separate gaps. */
  splitAlternatives: string[];
  /** Matched skills that do not appear in the job description. */
  ungroundedMatches: string[];
  reportedMatches: number;
  raw?: unknown;
  error?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");

export function mentions(list: string[], aliases: string[]): boolean {
  return aliases.some((alias) => {
    const a = norm(alias);
    // Very short aliases ("C", "Go") must match a whole word, otherwise "Device drivers" would contain "c".
    if (a.length <= 2) return list.some((i) => i.toLowerCase().split(/[^a-z0-9+#]+/).includes(a));
    return list.some((i) => norm(i).includes(a));
  });
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length >= 2);

/** Lenient check: the item, or any of its words (2+ chars, not filler), appears in the job text. */
export function groundedIn(item: string, text: string): boolean {
  const filler = new Set(["and", "or", "the", "of", "with", "in", "for", "to", "experience", "years", "skills", "basic", "knowledge"]);
  const t = norm(text);
  if (t.includes(norm(item))) return true;
  const tw = new Set(words(text));
  return words(item).filter((w) => !filler.has(w)).some((w) => tw.has(w) || t.includes(norm(w)));
}

export function scoreCase(c: EvalCase, raw: unknown): CaseResult {
  const parsed = analysisSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      id: c.id, schemaValid: false, score: null, scoreInRange: false,
      missingFound: 0, missingTotal: c.expected.mustMissing.length, falseGaps: [], missedSkills: [],
      ungroundedGaps: [], contradictions: [], reportedGaps: 0, splitAlternatives: [], ungroundedMatches: [],
      reportedMatches: 0, error: "schema",
    };
  }
  const a = parsed.data;
  const [lo, hi] = c.expected.scoreRange;
  const missedSkills = c.expected.mustMissing.filter((al) => !mentions(a.missingSkills, al)).map((al) => al[0]);
  const falseGaps = c.expected.mustNotMissing.filter((al) => mentions(a.missingSkills, al)).map((al) => al[0]);
  return {
    id: c.id,
    schemaValid: true,
    score: a.matchScore,
    scoreInRange: a.matchScore >= lo && a.matchScore <= hi,
    missingFound: c.expected.mustMissing.length - missedSkills.length,
    missingTotal: c.expected.mustMissing.length,
    falseGaps,
    missedSkills,
    ungroundedGaps: a.missingSkills.filter((m) => !groundedIn(m, c.job)),
    contradictions: a.missingSkills.filter((m) => a.matchedSkills.some((x) => norm(x) === norm(m))),
    reportedGaps: a.missingSkills.length,
    splitAlternatives: (c.expected.alternatives ?? [])
      .filter((g) => a.missingSkills.filter((m) => g.some((alt) => mentions([m], [alt]))).length > 1)
      .map((g) => g.join(" or ")),
    ungroundedMatches: a.matchedSkills.filter((m) => !groundedIn(m, c.job)),
    reportedMatches: a.matchedSkills.length,
    raw: a,
  };
}

export function summarize(results: CaseResult[], cases: EvalCase[] = []) {
  const n = results.length;
  const found = results.reduce((s, r) => s + r.missingFound, 0);
  const total = results.reduce((s, r) => s + r.missingTotal, 0);
  const pct = (x: number) => (n === 0 ? 0 : Math.round((x / n) * 1000) / 10);
  return {
    cases: n,
    schemaValid: pct(results.filter((r) => r.schemaValid).length),
    scoreInRange: pct(results.filter((r) => r.scoreInRange).length),
    missingRecall: total === 0 ? 0 : Math.round((found / total) * 1000) / 10,
    casesWithFalseGaps: results.filter((r) => r.falseGaps.length > 0).length,
    gapPrecision: (() => {
      const rep = results.reduce((s, r) => s + r.reportedGaps, 0);
      const bad = results.reduce((s, r) => s + r.ungroundedGaps.length, 0);
      return rep === 0 ? 100 : Math.round(((rep - bad) / rep) * 1000) / 10;
    })(),
    contradictions: results.reduce((s, r) => s + r.contradictions.length, 0),
    splitAlternatives: results.reduce((s, r) => s + r.splitAlternatives.length, 0),
    alternativeGroups: cases.reduce((s, c) => s + (c.expected.alternatives?.length ?? 0), 0),
    matchPrecision: (() => {
      const rep = results.reduce((s, r) => s + r.reportedMatches, 0);
      const bad = results.reduce((s, r) => s + r.ungroundedMatches.length, 0);
      return rep === 0 ? 100 : Math.round(((rep - bad) / rep) * 1000) / 10;
    })(),
  };
}
