import { DISCRETIONARY_CATEGORIES, STRUCTURAL_CATEGORIES } from './categories';
import type { CategorySummary, FinancialTwin, Transaction, TwinFlag } from './types';
import { categorizeTransactions } from './categorize';
import { detectRecurring } from './recurring';
import { mean, stdev } from './rng';

function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function buildTwinFromTransactions(
  txnsRaw: Transaction[],
  opts: { label: string; source: 'demo' | 'csv'; cashBalance?: number },
): FinancialTwin {
  const txns = categorizeTransactions(txnsRaw).sort((a, b) => a.date.localeCompare(b.date));
  const monthsSet = new Set(txns.map((t) => monthKey(t.date)));
  const monthsObserved = Math.max(monthsSet.size, 1);

  const monthlyCredits = new Map<string, number>();
  const monthlyOutflow = new Map<string, number>();
  const catTotals = new Map<string, number>();

  for (const t of txns) {
    if (t.category === 'transfers') continue;
    const mk = monthKey(t.date);
    if (t.amount >= 0) {
      if (t.category === 'income') {
        monthlyCredits.set(mk, (monthlyCredits.get(mk) ?? 0) + t.amount);
      }
    } else {
      monthlyOutflow.set(mk, (monthlyOutflow.get(mk) ?? 0) - t.amount);
      catTotals.set(t.category!, (catTotals.get(t.category!) ?? 0) - t.amount);
    }
  }

  const creditSeries = [...monthlyCredits.values()];
  const outflowSeries = [...monthlyOutflow.values()];

  const monthlyIncome = Math.round(mean(creditSeries));
  const incomeVolatility =
    creditSeries.length >= 3
      ? Math.round(stdev(creditSeries))
      : Math.round(monthlyIncome * 0.22);

  const avgByCat = (c: string) => Math.round((catTotals.get(c) ?? 0) / monthsObserved);

  const recurring = detectRecurring(txns);
  const emiFromRecurring = recurring
    .filter((r) => r.kind === 'debt' && r.confidence >= 0.5)
    .reduce((a, r) => a + r.monthlyAmount, 0);
  const emiMonthly = emiFromRecurring > 0 ? emiFromRecurring : avgByCat('debt_emi');

  const fixedExpenses = STRUCTURAL_CATEGORIES.reduce((a, c) => a + avgByCat(c), 0);

  const discretionaryMonthly = DISCRETIONARY_CATEGORIES.reduce((a, c) => a + avgByCat(c), 0);

  const totalOutflowAvg = Math.round(mean(outflowSeries.length ? outflowSeries : [0]));
  const variableExpenses = Math.max(0, totalOutflowAvg - fixedExpenses - emiMonthly);

  const cashBalance =
    opts.cashBalance !== undefined && opts.cashBalance > 0
      ? opts.cashBalance
      : Math.round(totalOutflowAvg * 1.2);

  const categories: CategorySummary[] = [...catTotals.entries()]
    .map(([c, total]) => ({
      category: c as CategorySummary['category'],
      monthlyAvg: Math.round(total / monthsObserved),
      share: totalOutflowAvg > 0 ? total / monthsObserved / totalOutflowAvg : 0,
    }))
    .filter((s) => s.monthlyAvg > 0)
    .sort((a, b) => b.monthlyAvg - a.monthlyAvg);

  const burn = fixedExpenses + variableExpenses + emiMonthly;
  const runwayMonths = burn > 0 ? cashBalance / burn : 12;
  const incomeCv = monthlyIncome > 0 ? incomeVolatility / monthlyIncome : 0;

  const emergencyBufferTarget = Math.round(burn * Math.min(3 + incomeCv * 6, 9));

  const flags: TwinFlag[] = [];
  if (runwayMonths < 1)
    flags.push({
      kind: 'thin_buffer',
      message: `Liquid buffer covers only ${runwayMonths.toFixed(1)} months of expenses.`,
    });
  else if (runwayMonths < 3)
    flags.push({
      kind: 'thin_buffer',
      message: `Buffer covers ${runwayMonths.toFixed(1)} months — below the ${emergencyBufferTarget.toLocaleString('en-IN')} target reserve.`,
    });
  if (incomeCv > 0.35)
    flags.push({
      kind: 'volatile_income',
      message: `Income varies ±${Math.round(incomeCv * 100)}% month to month.`,
    });
  const commitmentLoad = monthlyIncome > 0 ? (fixedExpenses + emiMonthly) / monthlyIncome : 0;
  if (commitmentLoad > 0.55)
    flags.push({
      kind: 'dangerous_commitment',
      message: `Rent, bills and EMIs consume ${Math.round(commitmentLoad * 100)}% of income.`,
    });

  return {
    label: opts.label,
    source: opts.source,
    generatedAt: new Date().toISOString(),
    monthsObserved,
    cashBalance,
    monthlyIncome,
    incomeVolatility,
    fixedExpenses,
    variableExpenses,
    discretionaryMonthly,
    emiMonthly,
    emergencyBufferTarget,
    recurring: recurring.filter((r) => r.confidence >= 0.55),
    categories,
    flags,
  };
}

export interface ManualInputs {
  label: string;
  cashBalance: number;
  monthlyIncome: number;
  incomeVolatilityPct: number;
  rent: number;
  utilities: number;
  otherFixed: number;
  emiMonthly: number;
  discretionaryMonthly: number;
}

export function buildTwinFromManual(inputs: ManualInputs): FinancialTwin {
  const fixedExpenses = inputs.rent + inputs.utilities + inputs.otherFixed;
  const burn = fixedExpenses + inputs.discretionaryMonthly + inputs.emiMonthly;
  const incomeCv = inputs.monthlyIncome > 0 ? inputs.incomeVolatilityPct / 100 : 0;
  const runwayMonths = burn > 0 ? inputs.cashBalance / burn : 12;

  const categories: CategorySummary[] = [];
  const push = (category: CategorySummary['category'], monthlyAvg: number) => {
    if (monthlyAvg > 0) categories.push({ category, monthlyAvg, share: 0 });
  };
  push('rent', inputs.rent);
  push('utilities', inputs.utilities);
  push('other', inputs.otherFixed);
  push('dining', inputs.discretionaryMonthly);
  push('debt_emi', inputs.emiMonthly);
  for (const s of categories) s.share = burn > 0 ? s.monthlyAvg / burn : 0;

  const flags: TwinFlag[] = [];
  if (runwayMonths < 1)
    flags.push({
      kind: 'thin_buffer',
      message: `Liquid buffer covers only ${runwayMonths.toFixed(1)} months of expenses.`,
    });
  else if (runwayMonths < 3)
    flags.push({
      kind: 'thin_buffer',
      message: `Buffer covers ${runwayMonths.toFixed(1)} months of expenses — thin.`,
    });
  if (incomeCv > 0.35)
    flags.push({
      kind: 'volatile_income',
      message: `Declared income volatility is ±${Math.round(incomeCv * 100)}%.`,
    });
  const commitmentLoad = inputs.monthlyIncome > 0 ? (fixedExpenses + inputs.emiMonthly) / inputs.monthlyIncome : 0;
  if (commitmentLoad > 0.55)
    flags.push({
      kind: 'dangerous_commitment',
      message: `Fixed obligations and EMIs consume ${Math.round(commitmentLoad * 100)}% of income.`,
    });

  return {
    label: inputs.label || 'My finances',
    source: 'manual',
    generatedAt: new Date().toISOString(),
    monthsObserved: 0,
    cashBalance: inputs.cashBalance,
    monthlyIncome: inputs.monthlyIncome,
    incomeVolatility: Math.round((inputs.incomeVolatilityPct / 100) * inputs.monthlyIncome),
    fixedExpenses,
    variableExpenses: inputs.discretionaryMonthly,
    discretionaryMonthly: inputs.discretionaryMonthly,
    emiMonthly: inputs.emiMonthly,
    emergencyBufferTarget: Math.round(burn * Math.min(3 + incomeCv * 6, 9)),
    recurring: [],
    categories,
    flags,
  };
}
