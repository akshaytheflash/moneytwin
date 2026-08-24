'use client';

import { useEffect, useRef, useState } from 'react';
import type { FinancialTwin } from '@/lib/engine/types';

interface DemoMeta {
  id: string;
  label: string;
  tagline: string;
  cashBalance: number;
}

export default function ProfileStage({ onReady }: { onReady: (twin: FinancialTwin) => void }) {
  const [profiles, setProfiles] = useState<DemoMeta[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showManual, setShowManual] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvBalance, setCsvBalance] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profiles')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setProfiles(d.profiles ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load demo profiles.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function build(body: Record<string, unknown>, key: string) {
    setLoading(key);
    setError(null);
    setWarnings([]);
    try {
      const res = await fetch('/api/twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not build the financial twin.');
        if (Array.isArray(data.details)) setWarnings(data.details);
        return;
      }
      if (Array.isArray(data.warnings)) setWarnings(data.warnings);
      onReady(data.twin as FinancialTwin);
    } catch {
      setError('Network error while building the twin.');
    } finally {
      setLoading(null);
    }
  }

  async function handleCsv(file: File) {
    const text = await file.text();
    const balanceNum = Number(csvBalance);
    build(
      {
        source: 'csv',
        csv: text,
        label: file.name.replace(/\.csv$/i, '').slice(0, 60),
        cashBalance: Number.isFinite(balanceNum) && balanceNum > 0 ? balanceNum : undefined,
      },
      'csv',
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10">
      <p className="eyebrow mb-4">A personal financial digital twin</p>
      <h1 className="display max-w-3xl text-[clamp(2.4rem,6vw,4.6rem)]">
        What happens to my money if something goes wrong?
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-inksoft">
        MONEYTWIN builds a working model of your finances, forecasts your cash flow with
        uncertainty bands, stress-tests it against real shocks — a job loss, a medical bill,
        an EMI you can&apos;t dodge — then finds the cheapest way to cut the risk.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <span className="eyebrow">Start with</span>
        <button type="button" className={`chip ${showManual ? '' : 'chip-on'}`} onClick={() => setShowManual(false)}>
          Demo profiles
        </button>
        <button type="button" className={`chip ${showManual ? 'chip-on' : ''}`} onClick={() => setShowManual(true)}>
          Enter numbers manually
        </button>
      </div>

      {!showManual ? (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {(profiles.length ? profiles : [null, null, null]).map((p, i) =>
              p === null ? (
                <div key={i} className="panel animate-pulse p-5 opacity-50" style={{ minHeight: 150 }} />
              ) : (
                <button
                  key={p.id}
                  type="button"
                  disabled={loading !== null}
                  onClick={() => build({ source: 'demo', profileId: p.id }, `demo-${p.id}`)}
                  className="panel group p-5 text-left transition-transform hover:-translate-y-1 hover:shadow-[7px_7px_0_rgba(16,27,23,0.85)] disabled:opacity-50"
                >
                  <span className="eyebrow">{loading === `demo-${p.id}` ? 'Building twin…' : 'Demo profile'}</span>
                  <h3 className="mt-2 font-semibold leading-snug">{p.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-inksoft">{p.tagline}</p>
                  <span className="num mt-3 inline-block text-xs text-petrol">
                    liquid buffer ≈ ₹{p.cashBalance.toLocaleString('en-IN')} →
                  </span>
                </button>
              ),
            )}
          </div>

          <div className="panel-flat mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex-1">
              <span className="eyebrow">Or use your own data</span>
              <p className="mt-1 text-sm text-inksoft">
                Upload a bank statement CSV with date, description and amount columns. Nothing
                leaves your machine except this page&apos;s own server.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCsv(f);
              }}
            />
            <label className="eyebrow shrink-0">
              Current balance (₹, optional)
            </label>
            <input
              className="field num w-36 shrink-0"
              placeholder="e.g. 85000"
              value={csvBalance}
              onChange={(e) => setCsvBalance(e.target.value)}
            />
            <button type="button" className="btn shrink-0" disabled={loading !== null} onClick={() => fileRef.current?.click()}>
              {loading === 'csv' ? 'Parsing…' : 'Choose CSV'}
            </button>
          </div>
        </>
      ) : (
        <ManualForm onSubmit={(m, label) => build({ source: 'manual', manual: m, label }, 'manual')} busy={loading === 'manual'} />
      )}

      {error && (
        <div className="panel mt-6 border-signal bg-[#fdf1ec] p-4" role="alert">
          <p className="num text-sm font-semibold text-signal">{error}</p>
          {warnings.map((w, i) => (
            <p key={i} className="num mt-1 text-xs text-inksoft">
              · {w}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function ManualForm({
  onSubmit,
  busy,
}: {
  onSubmit: (m: Record<string, number>, label: string) => void;
  busy: boolean;
}) {
  const [v, setV] = useState({
    monthlyIncome: '95000',
    incomeVolatilityPct: '15',
    rent: '24000',
    utilities: '3500',
    otherFixed: '2000',
    emiMonthly: '10000',
    discretionaryMonthly: '18000',
    cashBalance: '150000',
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const nums = Object.fromEntries(Object.entries(v).map(([k, s]) => [k, Math.max(0, Number(s) || 0)]));

  return (
    <form
      className="panel mt-5 grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (nums.monthlyIncome > 0) onSubmit(nums, 'My finances');
      }}
    >
      {(
        [
          ['monthlyIncome', 'Monthly income (₹)', true],
          ['cashBalance', 'Cash + savings today (₹)', true],
          ['rent', 'Rent / housing (₹/mo)'],
          ['utilities', 'Utilities & bills (₹/mo)'],
          ['otherFixed', 'Other fixed costs (₹/mo)'],
          ['emiMonthly', 'Loan EMIs (₹/mo)'],
          ['discretionaryMonthly', 'Discretionary spend (₹/mo)'],
          ['incomeVolatilityPct', 'Income volatility (±%)'],
        ] as const
      ).map(([key, labelText, highlight]) => (
        <label key={key} className="block">
          <span className={`eyebrow block ${highlight ? 'text-petrol' : ''}`}>{labelText}</span>
          <input className={`field num mt-2 ${highlight ? 'border-petrol' : ''}`} inputMode="decimal" value={v[key]} onChange={set(key)} />
        </label>
      ))}
      <div className="sm:col-span-2 lg:col-span-4">
        <button type="submit" className="btn btn-primary" disabled={busy || nums.monthlyIncome <= 0}>
          {busy ? 'Building twin…' : 'Build financial twin'}
        </button>
      </div>
    </form>
  );
}
