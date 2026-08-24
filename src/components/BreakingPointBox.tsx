'use client';

import { useState } from 'react';
import type { FinancialTwin, ShockType } from '@/lib/engine/types';

interface BreakingPoint {
  largestSurvivable: { id: ShockType; [k: string]: unknown } | null;
  breakingShock: { id: ShockType; [k: string]: unknown };
  message: string;
}

const OPTIONS: { id: ShockType; label: string }[] = [
  { id: 'one_time_expense', label: 'Sudden expense (how big?)' },
  { id: 'income_drop_pct', label: 'Income drop (how deep?)' },
  { id: 'income_loss', label: 'Months without income (how many?)' },
  { id: 'new_emi', label: 'New EMI (how large?)' },
  { id: 'recurring_increase', label: 'Recurring cost increase (how much?)' },
  { id: 'salary_delay', label: 'Salary delay (how long?)' },
];

export default function BreakingPointBox({
  twin,
  horizon,
}: {
  twin: FinancialTwin;
  horizon: number;
}) {
  const [id, setId] = useState<ShockType>('one_time_expense');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BreakingPoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/reverse-stress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twin, template: { id }, horizonMonths: horizon }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Could not compute the limit.');
      else setResult(data.breakingPoint as BreakingPoint);
    } catch {
      setError('Network error while searching for the limit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-6">
      <h3 className="eyebrow">How bad can it get?</h3>
      <p className="mt-1 text-sm text-inksoft">
        We search for the largest version of a shock your finances can absorb before the odds of
        running out of money tip past 50%.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <select
          className="field flex-1"
          value={id}
          onChange={(e) => setId(e.target.value as ShockType)}
          aria-label="Type of shock to test"
        >
          {OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary shrink-0" disabled={busy} onClick={find}>
          {busy ? 'Searching…' : 'Find my limit'}
        </button>
      </div>
      {error && <p className="num mt-3 text-sm font-semibold text-signal">{error}</p>}
      {result && (
        <div
          className="mt-4 rounded-lg border-2 bg-white p-4"
          style={{ borderColor: result.largestSurvivable ? '#0f5852' : '#d94c25' }}
          aria-live="polite"
        >
          <p className="text-sm leading-relaxed">{result.message}</p>
        </div>
      )}
    </div>
  );
}
