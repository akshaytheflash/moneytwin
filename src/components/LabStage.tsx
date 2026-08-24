'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import RunwayChart from './RunwayChart';
import RiskDial from './RiskDial';
import { describeShock } from '@/lib/engine/forecast';
import { inr } from '@/lib/engine/format';
import type {
  FinancialTwin,
  Shock,
  SimulationResult,
} from '@/lib/engine/types';
import type { OptimizeResult } from '@/lib/engine/interventions';
import { parseScenarioText } from '@/lib/scenarioText';

type SimPair = { baseline: SimulationResult; stressed: SimulationResult };

const PRESETS: { label: string; shocks: Shock[] }[] = [
  { label: 'Medical emergency ₹80k', shocks: [{ id: 'one_time_expense', amount: 80000, startMonth: 1 }] },
  { label: 'Job loss · 2 months', shocks: [{ id: 'income_loss', months: 2 }] },
  { label: 'Income −25% · 6 mo', shocks: [{ id: 'income_drop_pct', pct: 25, months: 6 }] },
  { label: 'Salary delayed 30 days', shocks: [{ id: 'salary_delay', days: 30 }] },
  { label: 'New EMI ₹15k', shocks: [{ id: 'new_emi', amount: 15000 }] },
  { label: 'Rent hike ₹5k', shocks: [{ id: 'recurring_increase', amount: 5000, name: 'Rent hike' }] },
  {
    label: 'Double whammy',
    shocks: [
      { id: 'income_drop_pct', pct: 20, months: 12 },
      { id: 'one_time_expense', amount: 40000, startMonth: 2 },
    ],
  },
];

export default function LabStage({ twin }: { twin: FinancialTwin }) {
  const [horizon, setHorizon] = useState(6);
  const [shocks, setShocks] = useState<Shock[]>([]);
  const [sim, setSim] = useState<SimPair | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nlText, setNlText] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [targetPct, setTargetPct] = useState(10);
  const [opt, setOpt] = useState<OptimizeResult | null>(null);
  const [optBusy, setOptBusy] = useState(false);
  const ranOnce = useRef(false);

  const runSimulation = useCallback(
    async (shockList: Shock[], h: number) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ twin, scenario: { shocks: shockList, horizonMonths: h } }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Simulation failed.');
          return;
        }
        setSim(data as SimPair);
        setOpt(null);
      } catch {
        setError('Network error during simulation.');
      } finally {
        setBusy(false);
      }
    },
    [twin],
  );

  useEffect(() => {
    if (!ranOnce.current) {
      ranOnce.current = true;
      runSimulation([], horizon);
    }
  }, [runSimulation, horizon]);

  function applyShocks(list: Shock[], presetLabel: string | null = null) {
    setShocks(list);
    setActivePreset(presetLabel);
    runSimulation(list, horizon);
  }

  function togglePreset(label: string, preset: Shock[]) {
    if (activePreset === label) applyShocks([]);
    else applyShocks(preset, label);
  }

  function handleHorizon(h: number) {
    setHorizon(h);
    runSimulation(shocks, h);
  }

  function submitNaturalLanguage() {
    const parsed = parseScenarioText(nlText);
    if (!parsed) {
      setError('Could not read a shock from that sentence. Try something like "lose my job for 3 months".');
      return;
    }
    setError(null);
    applyShocks(parsed);
  }

  async function runOptimizer() {
    if (shocks.length === 0) return;
    setOptBusy(true);
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twin,
          scenario: { shocks, horizonMonths: horizon },
          targetProbability: targetPct / 100,
        }),
      });
      const data = await res.json();
      if (res.ok) setOpt((data.optimize ?? data) as OptimizeResult);
      else setError(data.error ?? 'Optimizer failed.');
    } catch {
      setError('Network error during optimization.');
    } finally {
      setOptBusy(false);
    }
  }

  function downloadReport() {
    if (!sim) return;
    const s = sim.stressed;
    const lines: string[] = [
      '# MONEYTWIN stress report',
      '',
      `Generated: ${new Date().toLocaleString()}`,
      `Profile: ${twin.label}`,
      `Horizon: ${horizon} months · Monte Carlo paths: ${s.paths}`,
      '',
      '## Financial twin',
      `- Liquid buffer: ${inr(twin.cashBalance)}`,
      `- Income: ${inr(twin.monthlyIncome)}/mo (± ${inr(twin.incomeVolatility)})`,
      `- Fixed obligations: ${inr(twin.fixedExpenses + twin.emiMonthly)}/mo`,
      `- Variable spend: ${inr(twin.variableExpenses)}/mo (${inr(twin.discretionaryMonthly)} discretionary)`,
      `- Emergency reserve target: ${inr(twin.emergencyBufferTarget)}`,
      '',
      '## Scenario',
      ...(shocks.length ? shocks.map((x) => `- ${describeShock(x)}`) : ['- Baseline (no shocks)']),
      '',
      '## Result',
      `- Probability of liquidity failure: ${(s.probabilityOfFailure * 100).toFixed(0)}%`,
      `- Median minimum balance: ${inr(s.medianMinBalance)}`,
      `- Worst-case minimum balance: ${inr(s.worstCaseMinBalance)}`,
      s.medianExhaustionMonth !== null ? `- Median cash exhaustion: month ${s.medianExhaustionMonth}` : '- No exhaustion in median path',
      '',
      '## Why',
      ...s.drivers.map((d) => `- **${d.label}** — ${d.detail}`),
      '',
    ];
    if (opt && opt.steps.length > 0) {
      lines.push(
        '## Intervention plan',
        `Baseline risk ${(opt.baselineRisk * 100).toFixed(0)}% → after plan ${(opt.finalRisk * 100).toFixed(0)}% (target ≤ ${targetPct}%)`,
        '',
        ...opt.steps.map(
          (st, i) =>
            `${i + 1}. ${st.name}: ${(st.riskBefore * 100).toFixed(0)}% → ${(st.riskAfter * 100).toFixed(0)}%`,
        ),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'moneytwin-stress-report.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <p className="eyebrow">Stress lab</p>
      <h2 className="display mt-2 text-3xl sm:text-4xl">Break the future on purpose</h2>
      <p className="mt-3 max-w-2xl text-inksoft">
        Pick shocks or describe them in plain words. The engine replays{' '}
        {(sim?.stressed.paths ?? 2000).toLocaleString()} simulated futures of your finances.
      </p>

      <div className="panel mt-6 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">Horizon</span>
          {[3, 6, 12].map((h) => (
            <button
              key={h}
              type="button"
              className={`chip num ${horizon === h ? 'chip-on' : ''}`}
              onClick={() => handleHorizon(h)}
            >
              {h} mo
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Shocks</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`chip ${activePreset === p.label ? 'chip-on' : ''}`}
              onClick={() => togglePreset(p.label, p.shocks)}
            >
              {p.label}
            </button>
          ))}
          {shocks.length > 0 && (
            <button type="button" className="chip" onClick={() => applyShocks([])}>
              ✕ clear all
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="field flex-1"
            placeholder='Describe a scenario, e.g. "lose my job for 3 months" or "medical emergency 60000"'
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNaturalLanguage()}
          />
          <button type="button" className="btn" onClick={submitNaturalLanguage}>
            Add scenario
          </button>
        </div>

        {shocks.length > 0 && (
          <ul className="num mt-4 flex flex-wrap gap-2 text-xs">
            {shocks.map((s, i) => (
              <li key={i} className="panel-flat px-3 py-1.5 font-semibold">
                {describeShock(s)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="panel mt-4 border-signal bg-[#fdf1ec] p-4 text-sm font-semibold text-signal" role="alert">
          {error}
        </p>
      )}

      {sim && (
        <>
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[300px_1fr]">
            <div className="panel p-6 text-center">
              <p className="eyebrow">Liquidity failure probability</p>
              <div className="mt-2 flex justify-center">
                <RiskDial probability={sim.stressed.probabilityOfFailure} severity={sim.stressed.severity} size={220} />
              </div>
              {shocks.length > 0 && sim.stressed.probabilityOfFailure !== sim.baseline.probabilityOfFailure && (
                <p className="num mt-2 text-xs text-inksoft">
                  baseline {(sim.baseline.probabilityOfFailure * 100).toFixed(0)}% → stressed{' '}
                  {(sim.stressed.probabilityOfFailure * 100).toFixed(0)}%
                </p>
              )}
              <dl className="num mt-4 space-y-2 border-t-2 border-line pt-4 text-left text-xs">
                <Row k="Median min balance" v={inr(sim.stressed.medianMinBalance)} bad={sim.stressed.medianMinBalance < 0} />
                <Row k="Worst-case min balance" v={inr(sim.stressed.worstCaseMinBalance)} bad={sim.stressed.worstCaseMinBalance < 0} />
                <Row
                  k="Median exhaustion"
                  v={sim.stressed.medianExhaustionMonth !== null ? `month ${sim.stressed.medianExhaustionMonth}` : '— none'}
                  bad={sim.stressed.medianExhaustionMonth !== null}
                />
                <Row k="Buffer at horizon (median)" v={inr(sim.stressed.expectedBufferAtHorizon)} />
              </dl>
            </div>

            <div className="panel p-5 pt-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-2 pb-1">
                <h3 className="eyebrow">Projected balance · {horizon}-month runway</h3>
                <p className="num text-xs text-inksoft">
                  band = middle 90% of futures · dashed amber = no-shock baseline
                </p>
              </div>
              <RunwayChart
                points={shocks.length ? sim.stressed.points : sim.baseline.points}
                compareMedian={shocks.length ? sim.baseline.points.map((p) => p.p50) : undefined}
              />
              <div className="flex justify-end px-2">
                <button type="button" className="btn" onClick={downloadReport}>
                  Download report ↓
                </button>
              </div>
            </div>
          </div>

          <div className="panel mt-6 p-6">
            <h3 className="eyebrow">Why this number</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {sim.stressed.drivers.map((d, i) => (
                <li key={i} className="border-l-4 border-petrol bg-white/60 py-2 pl-4 pr-3">
                  <p className="num text-xs font-bold uppercase tracking-wide">{d.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-inksoft">{d.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          {shocks.length > 0 && (
            <div className="panel mt-6 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="eyebrow">Intervention optimizer</h3>
                  <p className="mt-1 max-w-xl text-sm text-inksoft">
                    Find the cheapest combination of realistic moves that pushes failure risk below
                    your target.
                  </p>
                </div>
                <label className="flex items-center gap-3">
                  <span className="eyebrow">Target risk ≤ {targetPct}%</span>
                  <input
                    type="range"
                    min={5}
                    max={40}
                    step={1}
                    value={targetPct}
                    onChange={(e) => setTargetPct(Number(e.target.value))}
                    className="w-36 accent-[#0f5852]"
                    aria-label="Target failure probability percent"
                  />
                </label>
                <button type="button" className="btn btn-primary" disabled={optBusy || busy} onClick={runOptimizer}>
                  {optBusy ? 'Optimizing…' : 'Find interventions'}
                </button>
              </div>

              {opt && (
                <div className="mt-5">
                  {opt.alreadyMet ? (
                    <p className="num rounded-lg border-2 border-petrol bg-mint p-4 text-sm">
                      Baseline risk is already {(opt.baselineRisk * 100).toFixed(0)}% — at or below
                      your {targetPct}% target. No intervention needed.
                    </p>
                  ) : (
                    <>
                      <ol className="space-y-3">
                        {opt.steps.map((step, i) => (
                          <li key={step.interventionId} className="rounded-lg border-2 border-ink bg-white p-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="font-semibold">
                                <span className="num mr-2 text-petrol">{i + 1}.</span>
                                {step.name}
                              </p>
                              <p className="num text-sm">
                                <span className="text-signal">{(step.riskBefore * 100).toFixed(0)}%</span>
                                {' → '}
                                <span className="font-bold text-petrol">{(step.riskAfter * 100).toFixed(0)}%</span>
                                <span className="ml-2 text-xs text-inksoft">
                                  ({(step.marginalGain * 100).toFixed(0)} pp)
                                </span>
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-inksoft">{step.description}</p>
                            <div className="mt-2 h-2.5 border border-ink bg-paper">
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.min(100, step.riskAfter * 100)}%`,
                                  background: step.riskAfter <= targetPct / 100 ? '#0f5852' : '#b57a06',
                                }}
                              />
                            </div>
                          </li>
                        ))}
                      </ol>
                      <p className="num mt-4 text-sm">
                        Plan result: {(opt.baselineRisk * 100).toFixed(0)}% →{' '}
                        <strong style={{ color: opt.achievedTarget ? '#0f5852' : '#d94c25' }}>
                          {(opt.finalRisk * 100).toFixed(0)}%
                        </strong>{' '}
                        · total lifestyle cost ≈ {inr(opt.totalMonthlySacrifice)}/mo ·{' '}
                        {opt.achievedTarget ? 'target achieved ✓' : `still above the ${targetPct}% target — consider a larger buffer`}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {busy && (
        <p className="num mt-6 animate-pulse text-sm text-inksoft" aria-live="polite">
          Simulating thousands of futures…
        </p>
      )}
    </section>
  );
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-inksoft">{k}</dt>
      <dd className={`font-semibold ${bad ? 'text-signal' : ''}`}>{v}</dd>
    </div>
  );
}
