'use client';

import { useState } from 'react';
import type { FinancialTwin, Shock, SimulationResult } from '@/lib/engine/types';
import { inr } from '@/lib/engine/format';

interface Verdict {
  kind: 'yes' | 'tight' | 'no';
  headline: string;
  detail: string;
}

export default function AffordCheck({
  twin,
  horizon,
  currentShocks,
  currentStressed,
}: {
  twin: FinancialTwin;
  horizon: number;
  currentShocks: Shock[];
  currentStressed: SimulationResult | null;
}) {
  const [amount, setAmount] = useState('50000');
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  async function check() {
    const amt = Number(amount.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) return;
    setBusy(true);
    setVerdict(null);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twin,
          scenario: {
            shocks: [...currentShocks, { id: 'one_time_expense', amount: amt, startMonth: 1 }],
            horizonMonths: horizon,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) return;
      const after = data.stressed.probabilityOfFailure;
      const minBal = data.stressed.medianMinBalance;
      const before = currentStressed?.probabilityOfFailure ?? data.baseline.probabilityOfFailure;
      const delta = after - before;

      if (after < 0.5 && delta < 0.02 && minBal >= 0) {
        setVerdict({
          kind: 'yes',
          headline: 'Yes — comfortably.',
          detail: `Even with this ${inr(amt)} expense, only ${(after * 100).toFixed(0)}% of simulated futures run out of money, and the typical future never dips below ${inr(minBal)}.`,
        });
      } else if (after >= 0.5) {
        setVerdict({
          kind: 'no',
          headline: 'Not safely.',
          detail: `After spending ${inr(amt)}, ${(after * 100).toFixed(0)}% of simulated futures run out of money before month ${horizon}. Build the buffer first, or find a smaller number.`,
        });
      } else {
        setVerdict({
          kind: 'tight',
          headline: 'Tight, but probably survivable.',
          detail: `This raises your chance of running out from ${(before * 100).toFixed(0)}% to ${(after * 100).toFixed(0)}%, and the typical future bottoms out at ${inr(minBal)}. Have a fallback plan.`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const color =
    verdict?.kind === 'yes' ? '#0f5852' : verdict?.kind === 'tight' ? '#b57a06' : '#d94c25';

  return (
    <div className="panel p-6">
      <h3 className="eyebrow">Can I afford it?</h3>
      <p className="mt-1 text-sm text-inksoft">
        Type a one-time expense and see whether your finances survive it.
      </p>
      <div className="mt-4 flex gap-2">
        <span className="num self-center font-semibold">₹</span>
        <input
          className="field num flex-1"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          aria-label="Expense amount in rupees"
        />
        <button type="button" className="btn btn-primary shrink-0" disabled={busy} onClick={check}>
          {busy ? 'Checking…' : 'Check'}
        </button>
      </div>
      {verdict && (
        <div className="mt-4 rounded-lg border-2 bg-white p-4" style={{ borderColor: color }} aria-live="polite">
          <p className="font-semibold" style={{ color }}>
            {verdict.headline}
          </p>
          <p className="num mt-1 text-sm leading-relaxed text-inksoft">{verdict.detail}</p>
        </div>
      )}
    </div>
  );
}
