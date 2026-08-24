'use client';

import { CATEGORY_LABELS } from '@/lib/engine/categories';
import { inr } from '@/lib/engine/format';
import { resilienceScore, bandColor } from '@/lib/engine/score';
import type { FinancialTwin } from '@/lib/engine/types';

const FLAG_COLOR: Record<FinancialTwin['flags'][number]['kind'], string> = {
  thin_buffer: '#d94c25',
  volatile_income: '#b57a06',
  dangerous_commitment: '#d94c25',
  unusual_spending: '#b57a06',
};

export default function TwinStage({
  twin,
  onContinue,
}: {
  twin: FinancialTwin;
  onContinue: () => void;
}) {
  const burn = twin.fixedExpenses + twin.variableExpenses + twin.emiMonthly;
  const runway = burn > 0 ? twin.cashBalance / burn : 0;
  const resilience = resilienceScore(twin);

  const stats: [string, string, string][] = [
    ['Liquid buffer', inr(twin.cashBalance), 'cash + savings today'],
    ['Income', `${inr(twin.monthlyIncome)}/mo`, `± ${inr(twin.incomeVolatility)} observed swing`],
    ['Fixed obligations', `${inr(twin.fixedExpenses + twin.emiMonthly)}/mo`, 'rent, bills, EMIs'],
    ['Variable spend', `${inr(twin.variableExpenses)}/mo`, `${inr(twin.discretionaryMonthly)} discretionary`],
    ['Runway', `${runway.toFixed(1)} mo`, `at ${inr(burn)} total burn`],
    ['Reserve target', inr(twin.emergencyBufferTarget), 'volatility-adjusted emergency fund'],
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Financial twin</p>
          <h2 className="display mt-2 text-3xl sm:text-4xl">{twin.label}</h2>
        </div>
        <div className="num text-right text-xs text-inksoft">
          <span className="panel-flat px-3 py-1 uppercase">{twin.source} source</span>
          <p className="mt-2">
            {twin.monthsObserved > 0 ? `${twin.monthsObserved} months of transactions analysed` : 'declared inputs'}
          </p>
        </div>
      </div>

      {twin.flags.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {twin.flags.map((f, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border-2 p-3" style={{ borderColor: FLAG_COLOR[f.kind] }}>
              <span aria-hidden className="num mt-0.5 font-bold" style={{ color: FLAG_COLOR[f.kind] }}>
                !
              </span>
              <p className="text-sm leading-relaxed">{f.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="panel p-5" style={{ borderTop: `6px solid ${bandColor(resilience.band)}` }} data-tour="twin-risk">
          <p className="eyebrow">Resilience score</p>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="num text-4xl font-bold" style={{ color: bandColor(resilience.band) }}>
              {resilience.score}
            </p>
            <p className="num text-sm font-semibold uppercase tracking-wide" style={{ color: bandColor(resilience.band) }}>
              {resilience.band}
            </p>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-inksoft">{resilience.headline}</p>
          <ul className="mt-3 space-y-2">
            {resilience.parts.map((p) => (
              <li key={p.label}>
                <div className="num flex justify-between text-xs">
                  <span>{p.label}</span>
                  <span className="text-inksoft">
                    {p.earned}/{p.max}
                  </span>
                </div>
                <div className="mt-1 h-2 bg-white border border-line">
                  <div
                    className="h-full"
                    style={{ width: `${(p.earned / p.max) * 100}%`, background: bandColor(resilience.band) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
        {stats.map(([labelText, value, sub]) => (
          <div key={labelText} className="panel p-5">
            <p className="eyebrow">{labelText}</p>
            <p className="num mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="num mt-1 text-xs text-inksoft">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <h3 className="eyebrow">Where the money goes each month</h3>
          <ul className="mt-4 space-y-3">
            {twin.categories.slice(0, 8).map((c) => (
              <li key={c.category}>
                <div className="num flex justify-between text-xs">
                  <span>{CATEGORY_LABELS[c.category]}</span>
                  <span>
                    {inr(c.monthlyAvg)} · {(c.share * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-3 border-2 border-ink bg-white">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(2, Math.min(100, c.share * 100))}%`,
                      background: c.category === 'debt_emi' || c.category === 'rent' ? '#d94c25' : '#0f5852',
                      opacity: 0.85,
                    }}
                  />
                </div>
              </li>
            ))}
            {twin.categories.length === 0 && (
              <li className="text-sm text-inksoft">No category breakdown for manual twins.</li>
            )}
          </ul>
        </div>

        <div className="panel p-6">
          <h3 className="eyebrow">Recurring commitments detected</h3>
          {twin.recurring.length > 0 ? (
            <table className="num mt-4 w-full text-sm">
              <thead>
                <tr className="border-b-2 border-ink text-left text-xs uppercase tracking-wider text-inksoft">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Monthly</th>
                  <th className="py-2 text-right">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {twin.recurring.map((r) => {
                  const heavy = r.kind === 'debt' && twin.monthlyIncome > 0 && r.monthlyAmount / twin.monthlyIncome > 0.15;
                  return (
                    <tr key={r.id} className="border-b border-line">
                      <td className="max-w-[220px] truncate py-2 pr-2">
                        {r.name}
                        {heavy && (
                          <span
                            className="num ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                            style={{ borderColor: '#d94c25', color: '#d94c25' }}
                            title="This EMI alone takes more than 15% of your income"
                          >
                            heavy
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold">{inr(r.monthlyAmount)}</td>
                      <td className="py-2 text-right text-inksoft">{(r.confidence * 100).toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-inksoft">
              Manual twins skip transaction mining. Upload a CSV to detect recurring payments
              automatically.
            </p>
          )}

          <button type="button" className="btn btn-primary mt-6 w-full" onClick={onContinue}>
            Open the stress lab →
          </button>
        </div>
      </div>
    </section>
  );
}
