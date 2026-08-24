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
      <p className="mt-3 max-w-2xl text-inksoft">
        A synthetic population of {report?.populationSize ?? 20} households with known parameters is
        stress-tested. The fast estimator (500 paths) is scored against a high-precision reference
        (4,000 paths), and the intervention optimizer is verified across the population.
      </p>

      {error && (
        <p className="panel mt-6 border-signal bg-[#fdf1ec] p-4 font-semibold text-signal" role="alert">
          {error}
        </p>
      )}

      {!report && !error && (
        <p className="num mt-8 animate-pulse" aria-live="polite">
          Running evaluation suite…
        </p>
      )}

      {report && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Brier score" value={report.calibration.brier.toFixed(3)} note="lower is better; 0 = perfect" />
            <Metric label="Prob. MAE" value={`${(report.calibration.mae * 100).toFixed(1)} pp`} note="fast vs reference estimator" />
            <Metric label="IQR coverage" value={`${(report.iqrCoverage * 100).toFixed(0)}%`} note="true median inside predicted IQR" />
            <Metric
              label="Per-sim cost"
              value={`${report.performanceMsPerSim.toFixed(1)} ms`}
              note="engine throughput"
            />
          </div>

          <div className="panel mt-6 overflow-x-auto p-6">
            <h2 className="eyebrow">Calibration by predicted-risk bin</h2>
            <table className="num mt-4 w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b-2 border-ink text-left text-xs uppercase tracking-wider text-inksoft">
                  <th className="py-2">Predicted risk</th>
                  <th className="py-2 text-right">Fast estimate</th>
                  <th className="py-2 text-right">Reference</th>
                  <th className="py-2 text-right">n</th>
                </tr>
              </thead>
              <tbody>
                {report.calibration.bins.map((b, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-2">{`${i * 20}–${(i + 1) * 20}%`}</td>
                    <td className="py-2 text-right">{(b.pHat * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right">{(b.pEmp * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right text-inksoft">{b.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Metric
              label="Avg risk reduction"
              value={`${report.interventionEffectiveness.avgReductionPp.toFixed(1)} pp`}
              note="optimizer across population"
            />
            <Metric
              label="Target hit rate"
              value={`${(report.interventionEffectiveness.targetHitRate * 100).toFixed(0)}%`}
              note="scenarios reaching the target"
            />
            <Metric
              label="Monotonicity violations"
              value={String(report.interventionEffectiveness.monotonicViolations)}
              note="steps that increased risk (should be 0)"
            />
          </div>

          <p className="num mt-6 text-xs text-inksoft">
            Forecast error vs analytic expectation: {report.forecastErrorPct.toFixed(1)}% of monthly
            burn at month 6 · report generated {new Date(report.generatedAtMs).toLocaleTimeString()}
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
      <p className="num mt-1 text-xs text-inksoft">{note}</p>
    </div>
  );
}
