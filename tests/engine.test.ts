import { describe, expect, it } from 'vitest';
import { makeGaussian, mean, mulberry32, percentile, stdev } from '@/lib/engine/rng';
import { categorizeDescription } from '@/lib/engine/categorize';
import { detectRecurring } from '@/lib/engine/recurring';
import { buildTwinFromTransactions } from '@/lib/engine/twin';
import { runSimulation, severityOf } from '@/lib/engine/forecast';
import { optimizeInterventions } from '@/lib/engine/interventions';
import { parseBankCsv } from '@/lib/engine/parse';
import { generateDemoTransactions } from '@/lib/engine/demo';
import type { FinancialTwin, Transaction } from '@/lib/engine/types';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('gaussian has roughly correct moments', () => {
    const rand = mulberry32(7);
    const g = makeGaussian(rand);
    const xs = Array.from({ length: 20000 }, () => g());
    expect(Math.abs(mean(xs))).toBeLessThan(0.05);
    expect(Math.abs(stdev(xs) - 1)).toBeLessThan(0.05);
  });

  it('percentile interpolates', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBeCloseTo(25);
    expect(percentile([5], 0.9)).toBe(5);
  });
});

describe('categorizer', () => {
  it.each([
    ['SALARY CREDIT STUDIO NOVA', 'income'],
    ['RENT UPI LANDLORD', 'rent'],
    ['BIKE LOAN EMI HDFC', 'debt_emi'],
    ['NETFLIX SUBSCRIPTION', 'subscriptions'],
    ['SWIGGY ORDER FOOD DELIVERY', 'dining'],
    ['BLINKIT GROCERY ORDER', 'groceries'],
    ['BESCOM ELECTRICITY BILL PAY', 'utilities'],
    ['AMAZON.IN ORDER', 'shopping'],
    ['UBER RIDE TRIP', 'transport'],
    ['APOLLO PHARMACY MEDICAL', 'health'],
  ])('%s -> %s', (desc, expected) => {
    expect(categorizeDescription(desc)).toBe(expected);
  });
});

function monthlySeries(name: string, day: number, amounts: number[], startYear = 2026): Transaction[] {
  return amounts.map((amount, i) => ({
    id: `${name}-${i}`,
    date: `${startYear}-${String(i + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    description: name,
    amount,
  }));
}

describe('recurring detection', () => {
  it('flags a regular EMI as recurring debt', () => {
    const txns = [
      ...monthlySeries('CAR LOAN EMI ICICI', 10, [-14000, -14000, -14000, -14000, -14000]),
    ];
    const items = detectRecurring(txns);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const emi = items.find((r) => r.name.includes('CAR LOAN'));
    expect(emi).toBeDefined();
    expect(emi!.kind).toBe('debt');
    expect(emi!.monthlyAmount).toBe(14000);
    expect(emi!.confidence).toBeGreaterThan(0.5);
  });

  it('ignores irregular spending', () => {
    const txns = [
      ...monthlySeries('SWIGGY ORDER FOOD DELIVERY', 3, [-500, -1400, -220, -900, -1600]),
    ];
    expect(detectRecurring(txns)).toHaveLength(0);
  });
});

export function makeTwin(overrides: Partial<FinancialTwin> = {}): FinancialTwin {
  return {
    label: 'test',
    source: 'demo',
    generatedAt: new Date().toISOString(),
    monthsObserved: 8,
    cashBalance: 60000,
    monthlyIncome: 100000,
    incomeVolatility: 5000,
    fixedExpenses: 30000,
    variableExpenses: 25000,
    discretionaryMonthly: 15000,
    emiMonthly: 10000,
    emergencyBufferTarget: 195000,
    recurring: [],
    categories: [],
    flags: [],
    ...overrides,
  };
}

describe('forecast engine', () => {
  const twin = makeTwin();
  const scenario = {
    horizonMonths: 6 as const,
    shocks: [{ id: 'income_drop_pct' as const, pct: 30, months: 6 }],
  };

  it('is deterministic given the same inputs', () => {
    const a = runSimulation(twin, scenario);
    const b = runSimulation(twin, scenario);
    expect(a.probabilityOfFailure).toBe(b.probabilityOfFailure);
    expect(a.points).toEqual(b.points);
  });

  it('produces ordered percentiles and valid probabilities', () => {
    const r = runSimulation(twin, scenario);
    for (const p of r.points) {
      expect(p.p05).toBeLessThanOrEqual(p.p50);
      expect(p.p50).toBeLessThanOrEqual(p.p95);
      expect(p.failureProb).toBeGreaterThanOrEqual(0);
      expect(p.failureProb).toBeLessThanOrEqual(1);
    }
    expect(r.points[0].p50).toBe(twin.cashBalance);
  });

  it('shocks strictly increase risk vs baseline', () => {
    const base = runSimulation(twin, { horizonMonths: 6, shocks: [] });
    const stressed = runSimulation(twin, scenario);
    expect(stressed.probabilityOfFailure).toBeGreaterThanOrEqual(base.probabilityOfFailure);
  });

  it('a comfortable twin has near-zero failure risk', () => {
    const rich = makeTwin({ cashBalance: 800000 });
    const r = runSimulation(rich, scenario);
    expect(r.probabilityOfFailure).toBeLessThan(0.02);
  });

  it('severity bands are monotonic', () => {
    expect(severityOf(0.05)).toBe('low');
    expect(severityOf(0.2)).toBe('moderate');
    expect(severityOf(0.4)).toBe('high');
    expect(severityOf(0.8)).toBe('critical');
  });
});

describe('intervention optimizer', () => {
  it('reduces risk on a stressed twin and reports the ladder', () => {
    const tight = makeTwin({
      cashBalance: 45000,
      fixedExpenses: 38000,
      variableExpenses: 30000,
      emiMonthly: 14000,
      discretionaryMonthly: 18000,
    });
    const scenario = {
      horizonMonths: 12 as const,
      shocks: [
        { id: 'income_drop_pct' as const, pct: 25 },
        { id: 'one_time_expense' as const, amount: 40000, startMonth: 2 },
      ],
    };
    const opt = optimizeInterventions(tight, scenario, 0.15);
    expect(opt.alreadyMet).toBe(false);
    expect(opt.steps.length).toBeGreaterThan(0);
    expect(opt.finalRisk).toBeLessThan(opt.baselineRisk);
  });
});

describe('twin building', () => {
  it('builds a coherent twin from demo transactions', () => {
    const { transactions, cashBalance } = generateDemoTransactions('meera');
    const twin = buildTwinFromTransactions(transactions, { label: 'meera', source: 'demo', cashBalance });
    expect(twin.monthlyIncome).toBeGreaterThan(80000);
    expect(twin.monthlyIncome).toBeLessThan(100000);
    expect(twin.emiMonthly).toBeGreaterThan(7000);
    expect(twin.fixedExpenses).toBeGreaterThan(20000);
    expect(twin.incomeVolatility).toBeLessThan(twin.monthlyIncome * 0.1);
    expect(twin.flags.length).toBeGreaterThanOrEqual(0);
  });

  it('arjun shows high income volatility', () => {
    const { transactions, cashBalance } = generateDemoTransactions('arjun');
    const twin = buildTwinFromTransactions(transactions, { label: 'arjun', source: 'demo', cashBalance });
    expect(twin.incomeVolatility / twin.monthlyIncome).toBeGreaterThan(0.35);
  });
});

describe('csv parser', () => {
  it('parses standard bank statement format with dd/mm/yyyy dates', () => {
    const csv = [
      'Date,Description,Withdrawal,Deposit',
      '01/03/2026,SALARY CREDIT ACME,-,92000',
      '03/03/2026,RENT UPI LANDLORD,24000,-',
      'not-a-date,BROKEN ROW,100,-',
    ].join('\n');
    const res = parseBankCsv(csv);
    expect(res.transactions).toHaveLength(2);
    expect(res.transactions[0].amount).toBe(92000);
    expect(res.transactions[1].amount).toBe(-24000);
    expect(res.warnings.some((w) => w.includes('skipped'))).toBe(true);
  });

  it('parses signed amount columns with ISO dates', () => {
    const csv = 'date,description,amount\n2026-03-05,"SWIGGY, ORDER",-850\n2026-03-06,REFUND CREDITED,1200\n';
    const res = parseBankCsv(csv);
    expect(res.transactions).toHaveLength(2);
    expect(res.transactions[0].amount).toBe(-850);
    expect(res.transactions[1].date).toBe('2026-03-06');
  });
});
