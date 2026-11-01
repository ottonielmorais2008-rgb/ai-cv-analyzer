"use client";

import { useState } from "react";
import { MAX_CV_CHARS, MAX_JOB_CHARS, type Analysis } from "./schema";

export default function Home() {
  const [cv, setCv] = useState("");
  const [job, setJob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, job }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  const scoreColor =
    result && result.matchScore >= 70 ? "text-emerald-600" : result && result.matchScore >= 40 ? "text-amber-600" : "text-rose-600";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">AI CV Analyzer</h1>
      <p className="mt-2 text-slate-600">
        Paste a CV and a job description. The AI returns a match score, the skills you have, the skills you are missing
        and concrete suggestions.
      </p>

      <form onSubmit={analyze} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-medium">CV</span>
          <textarea
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            maxLength={MAX_CV_CHARS}
            rows={14}
            placeholder="Paste the CV text here..."
            className="rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <span className="text-xs text-slate-500">{cv.length}/{MAX_CV_CHARS}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Job description</span>
          <textarea
            value={job}
            onChange={(e) => setJob(e.target.value)}
            maxLength={MAX_JOB_CHARS}
            rows={14}
            placeholder="Paste the job description here..."
            className="rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <span className="text-xs text-slate-500">{job.length}/{MAX_JOB_CHARS}</span>
        </label>
        <button
          type="submit"
          disabled={loading || cv.trim().length < 50 || job.trim().length < 50}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50 md:col-span-2"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </form>

      {error && <p className="mt-6 rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}

      {result && (
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-sm md:col-span-3">
            <p className="text-sm text-slate-500">Match score</p>
            <p className={`text-5xl font-bold ${scoreColor}`}>{result.matchScore}/100</p>
          </div>
          <List title="Matched skills" items={result.matchedSkills} tone="bg-emerald-50 text-emerald-800" />
          <List title="Missing skills" items={result.missingSkills} tone="bg-rose-50 text-rose-800" />
          <List title="Suggestions" items={result.suggestions} tone="bg-indigo-50 text-indigo-800" />
        </section>
      )}

      <footer className="mt-12 text-center text-xs text-slate-500">
        Built with Next.js, the AI SDK and the Vercel AI Gateway. Texts are not stored.{" "}
        <a className="underline" href="https://github.com/ottonielmorais2008-rgb/ai-cv-analyzer">Source code</a>
      </footer>
    </main>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.length === 0 && <li className="text-sm text-slate-500">None</li>}
        {items.map((item) => (
          <li key={item} className={`rounded-md px-3 py-1.5 text-sm ${tone}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
