import type { FinancialTwin } from './types';

export interface ScorePart {
  label: string;
  earned: number;
  max: number;
  note: string;
}

export interface ResilienceScore {
  score: number;
  band: 'solid' | 'fair' | 'fragile' | 'critical';
  headline: string;
  parts: ScorePart[];
}

const BANDS: Record<ResilienceScore['band'], { headline: string; color: string }> = {
  solid: { headline: 'Solid — your finances can absorb real shocks.', color: '#0f5852' },
  fair: { headline: 'Fair — one bad month would sting.', color: '#b57a06' },
  fragile: { headline: 'Fragile — a single shock could tip you over.', color: '#d94c25' },
  critical: { headline: 'Critical — running out of money is one surprise away.', color: '#8f1d06' },
};

export function bandColor(band: ResilienceScore['band']): string {
  return BANDS[band].color;
}

export function resilienceScore(twin: FinancialTwin): ResilienceScore {
  const burn = twin.fixedExpenses + twin.variableExpenses + twin.emiMonthly;
  const runway = burn > 0 ? twin.cashBalance / burn : 12;
  const load = twin.monthlyIncome > 0 ? (twin.fixedExpenses + twin.emiMonthly) / twin.monthlyIncome : 0;
  const cv = twin.monthlyIncome > 0 ? twin.incomeVolatility / twin.monthlyIncome : 0;
  const reserveAdequacy = twin.emergencyBufferTarget > 0 ? twin.cashBalance / twin.emergencyBufferTarget : 1;

  const runwayEarned = Math.round(Math.min(runway / 6, 1) * 40);
  const loadEarned = Math.round(Math.min(Math.max((0.7 - load) / (0.7 - 0.35), 0), 1) * 25);
  const volEarned = Math.round(Math.min(Math.max((0.5 - cv) / (0.5 - 0.1), 0), 1) * 20);
  const reserveEarned = Math.round(Math.min(reserveAdequacy, 1) * 15);

  const parts: ScorePart[] = [
    {
      label: 'Cash runway',
      earned: runwayEarned,
      max: 40,
      note: `${runway.toFixed(1)} months of expenses covered by today's buffer.`,
    },
    {
      label: 'Commitment load',
      earned: loadEarned,
      max: 25,
      note: `Rent, bills and EMIs take ${Math.round(load * 100)}% of income.`,
    },
    {
      label: 'Income stability',
      earned: volEarned,
      max: 20,
      note:
        twin.monthsObserved > 0
          ? `Month-to-month income swings about ±${Math.round(cv * 100)}%.`
          : `Declared volatility of ±${Math.round(cv * 100)}%.`,
    },
    {
      label: 'Emergency reserve',
      earned: reserveEarned,
      max: 15,
      note: `You hold ${Math.round(reserveAdequacy * 100)}% of the recommended ${twin.emergencyBufferTarget.toLocaleString('en-IN')} reserve.`,
    },
  ];

  const score = parts.reduce((a, p) => a + p.earned, 0);
  const band: ResilienceScore['band'] =
    score >= 75 ? 'solid' : score >= 55 ? 'fair' : score >= 35 ? 'fragile' : 'critical';

  return { score, band, headline: BANDS[band].headline, parts };
}
