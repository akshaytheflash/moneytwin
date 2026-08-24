'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { EvalReport } from '@/lib/engine/evaluate';

export default function EvaluationPage() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/evaluate')
      .then((r) => r.json())
      .then((d) => (d.report ? setReport(d.report as EvalReport) : setError(d.error ?? 'Evaluation failed.')))
      .catch(() => setError('Network error while running evaluation.'));
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <Link href="/" className="num text-xs uppercase tracking-widest underline decoration-line underline-offset-4">
        ← Back to MONEYTWIN
      </Link>
      <h1 className="display mt-6 text-4xl">Does the engine actually work?</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-inksoft">
        We create {report?.populationSize ?? 20} imaginary households with known finances, stress-test
        each one two ways — a quick pass (500 simulated futures) and a thorough pass (4,000 futures) —
        and check that the quick answers you see in the app closely match the thorough ones. We also
        verify that the recommended rescue plans genuinely lower risk.
      </p>

      <div className="panel-flat mt-5 p-4 text-sm leading-relaxed text-inksoft">
        <p>
          <strong className="text-ink">How to read this page:</strong> every number below is
          &ldquo;how close the fast engine is to the deep analysis&rdquo;, how reliable the shaded
          range on the chart is, or whether the advice actually helps. Plain-language notes sit under
          each figure; the technical term is in parentheses where one exists.
        </p>
      </div>

      {error && (
        <p className="panel mt-6 border-signal bg-[#fdf1ec] p-4 font-semibold text-signal" role="alert">
          {error}
        </p>
      )}

      {!report && !error && (
        <p className="num mt-8 animate-pulse" aria-live="polite">
          Running the test suite…
        </p>
      )}

      {report && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Prediction agreement"
              value={report.calibration.brier.toFixed(3)}
              note="How closely the fast engine's odds match the deep analysis across every household. 0 = identical. Under 0.05 here means they practically agree. (Brier score)"
            />
            <Metric
              label="Average miss"
              value={`${(report.calibration.mae * 100).toFixed(1)} pp`}
              note="On average, how many percentage points the quick estimate is off from the thorough one. (mean absolute error)"
            />
            <Metric
              label="Range reliability"
              value={`${(report.iqrCoverage * 100).toFixed(0)}%`}
              note="How often the true outcome landed inside the shaded 'likely range' on the chart. A healthy middle band catches reality roughly half the time or a bit more. (IQR coverage)"
            />
            <Metric
              label="Speed"
              value={`${report.performanceMsPerSim.toFixed(1)} ms`}
              note="Time to replay one household's future thousands of times — fast enough to feel instant in the app."
            />
          </div>

          <div className="panel mt-6 overflow-x-auto p-6">
            <h2 className="eyebrow">Quick estimate vs deep analysis</h2>
            <p className="mt-2 text-sm text-inksoft">
              Households grouped by how likely the app said they were to run out of money. If the two
              columns match, the numbers you see in the app are trustworthy.
            </p>
            <table className="num mt-4 w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b-2 border-ink text-left text-xs uppercase tracking-wider text-inksoft">
                  <th className="py-2">App said this chance of running out…</th>
                  <th className="py-2 text-right">Quick engine (500)</th>
                  <th className="py-2 text-right">Deep analysis (4,000)</th>
                  <th className="py-2 text-right">Households</th>
                </tr>
              </thead>
              <tbody>
                {report.calibration.bins.map((b, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-2">{`${i * 20}–${(i + 1) * 20}%`}</td>
                    <td className="py-2 text-right">{(b.pHat * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right font-semibold">{(b.pEmp * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right text-inksoft">{b.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Metric
              label="Average risk cut"
              value={`${report.interventionEffectiveness.avgReductionPp.toFixed(1)} pp`}
              note="Across all households, how much the recommended plan lowered the chance of running out of money, in percentage points."
            />
            <Metric
              label="Plans that hit the goal"
              value={`${(report.interventionEffectiveness.targetHitRate * 100).toFixed(0)}%`}
              note="Share of households where the plan brought risk under the target the user picked."
            />
            <Metric
              label="Advice that backfired"
              value={String(report.interventionEffectiveness.monotonicViolations)}
              note="Recommended moves that made things worse. This should always be 0."
            />
          </div>

          <p className="num mt-6 text-xs leading-relaxed text-inksoft">
            Sanity check: projected balances stayed within {report.forecastErrorPct.toFixed(1)}% of
            one month&apos;s spending of the exact arithmetic expectation at month 6 · report
            generated {new Date(report.generatedAtMs).toLocaleTimeString()}
          </p>
        </>
      )}
    </main>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="panel p-5">
      <p className="eyebrow">{label}</p>
      <p className="num mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-inksoft">{note}</p>
    </div>
  );
}
