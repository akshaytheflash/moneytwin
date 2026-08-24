import type { FinancialTwin, MonthlyPoint, RiskDriver, Scenario, Severity, Shock, SimulationResult } from './types';
import { hashSeed, makeGaussian, mulberry32, percentile } from './rng';

const DEFAULT_PATHS = 2000;
const VARIABLE_SIGMA = 0.35;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function shockWindow(shock: Shock, horizon: number): { start: number; end: number } {
  const start = Math.max(1, shock.startMonth ?? 1);
  const dur =
    shock.id === 'one_time_expense'
      ? 1
      : clamp(shock.months ?? horizon - start + 1, 1, horizon - start + 1);
  return { start, end: start + dur - 1 };
}

export function describeShock(s: Shock): string {
  switch (s.id) {
    case 'income_drop_pct':
      return `Income −${s.pct ?? 0}%${s.months ? ` for ${s.months} mo` : ''}`;
    case 'income_loss':
      return `Income lost${s.months ? ` for ${s.months} mo` : ''}`;
    case 'salary_delay':
      return `Salary delayed ${s.days ?? 0} days`;
    case 'one_time_expense':
      return `One-time expense ₹${(s.amount ?? 0).toLocaleString('en-IN')}`;
    case 'recurring_increase':
      return `${s.name ?? 'Recurring cost'} +₹${(s.amount ?? 0).toLocaleString('en-IN')}/mo`;
    case 'new_emi':
      return `New EMI ₹${(s.amount ?? 0).toLocaleString('en-IN')}/mo`;
  }
}

interface MonthEconomy {
  incomeFactor: number;
  incomeZeroed: boolean;
  carryFraction: number;
  extraOutflow: number;
  emiAddition: number;
}

function economyForMonth(shocks: Shock[], m: number, horizon: number): MonthEconomy {
  const e: MonthEconomy = {
    incomeFactor: 1,
    incomeZeroed: false,
    carryFraction: 0,
    extraOutflow: 0,
    emiAddition: 0,
  };
  for (const s of shocks) {
    const w = shockWindow(s, horizon);
    if (m < w.start || m > w.end) continue;
    switch (s.id) {
      case 'income_drop_pct':
        e.incomeFactor *= 1 - (s.pct ?? 0) / 100;
        break;
      case 'income_loss':
        e.incomeZeroed = true;
        break;
      case 'salary_delay':
        e.carryFraction = Math.max(e.carryFraction, clamp((s.days ?? 0) / 30, 0, 1));
        break;
      case 'one_time_expense':
        e.extraOutflow += s.amount ?? 0;
        break;
      case 'recurring_increase':
        e.extraOutflow += s.amount ?? 0;
        break;
      case 'new_emi':
        if (w.start === m || (s.startMonth ?? 1) <= m)
          e.emiAddition += s.amount ?? 0;
        break;
    }
  }
  return e;
}

function simulate(twin: FinancialTwin, scenario: Scenario, paths: number, seed: number): {
  columns: number[][];
  failByMonth: number[];
  exhaustMonths: number[];
} {
  const H = scenario.horizonMonths;
  const rand = mulberry32(seed);
  const gauss = makeGaussian(rand);

  const sigmaRel = clamp(
    twin.monthlyIncome > 0 ? twin.incomeVolatility / twin.monthlyIncome : 0.2,
    0.02,
    0.9,
  );
  const baseIncome = twin.monthlyIncome;
  const fixed = twin.fixedExpenses;
  const variable = twin.variableExpenses;
  const emiBase = twin.emiMonthly;

  const economies: MonthEconomy[] = [];
  for (let m = 1; m <= H; m++) economies.push(economyForMonth(scenario.shocks, m, H));

  const columns: number[][] = Array.from({ length: H + 1 }, () => new Array<number>(paths));
  const failByMonth = new Array<number>(H + 1).fill(0);
  const exhaustMonths: number[] = [];

  for (let p = 0; p < paths; p++) {
    let bal = twin.cashBalance;
    let carry = 0;
    let failed = false;
    let exhaustedAt = -1;
    let minBal = bal;
    columns[0][p] = bal;

    for (let m = 1; m <= H; m++) {
      const e = economies[m - 1];
      let inc = baseIncome * e.incomeFactor;
      inc *= Math.exp(gauss() * sigmaRel - 0.5 * sigmaRel * sigmaRel);
      if (e.incomeZeroed) inc = 0;
      const delayed = inc * e.carryFraction;
      const received = inc - delayed + carry;
      carry = delayed;

      const fixedM = fixed * (1 + gauss() * 0.03);
      const varM = variable * Math.exp(gauss() * VARIABLE_SIGMA - 0.5 * VARIABLE_SIGMA * VARIABLE_SIGMA);
      const out = fixedM + varM + emiBase + e.emiAddition + e.extraOutflow;

      bal += received - out;
      minBal = Math.min(minBal, bal);
      columns[m][p] = bal;
      if (!failed && bal < 0) {
        failed = true;
        exhaustedAt = m;
      }
    }
    if (exhaustedAt > 0) exhaustMonths.push(exhaustedAt);
    for (let m = exhaustedAt > 0 ? exhaustedAt : H + 1; m <= H; m++) failByMonth[m]++;
  }

  return { columns, failByMonth, exhaustMonths };
}

export function severityOf(pFail: number): Severity {
  if (pFail < 0.10) return 'low';
  if (pFail < 0.25) return 'moderate';
  if (pFail < 0.5) return 'high';
  return 'critical';
}

export function runSimulation(
  twin: FinancialTwin,
  scenario: Scenario,
  opts?: { paths?: number; seed?: number },
): SimulationResult {
  const paths = opts?.paths ?? DEFAULT_PATHS;
  const seed =
    opts?.seed ??
    hashSeed(`${twin.label}|${twin.cashBalance}|${twin.monthlyIncome}|${scenario.horizonMonths}|${JSON.stringify(scenario.shocks)}`);
  const H = scenario.horizonMonths;

  const { columns, failByMonth, exhaustMonths } = simulate(twin, scenario, paths, seed);

  const points: MonthlyPoint[] = [];
  for (let m = 0; m <= H; m++) {
    const col = [...columns[m]].sort((a, b) => a - b);
    points.push({
      month: m,
      p05: Math.round(percentile(col, 0.05)),
      p25: Math.round(percentile(col, 0.25)),
      p50: Math.round(percentile(col, 0.5)),
      p75: Math.round(percentile(col, 0.75)),
      p95: Math.round(percentile(col, 0.95)),
      failureProb: failByMonth[m] / paths,
    });
  }

  const sortedExhaust = [...exhaustMonths].sort((a, b) => a - b);
  const finalCol = [...columns[H]].sort((a, b) => a - b);
  const minBalances: number[] = [];
  for (let p = 0; p < paths; p++) {
    let mn = Infinity;
    for (let m = 0; m <= H; m++) mn = Math.min(mn, columns[m][p]);
    minBalances.push(mn);
  }
  minBalances.sort((a, b) => a - b);

  const probabilityOfFailure = points[H].failureProb;

  return {
    points,
    probabilityOfFailure,
    medianMinBalance: Math.round(percentile(minBalances, 0.5)),
    worstCaseMinBalance: Math.round(minBalances[0] ?? 0),
    medianExhaustionMonth:
      sortedExhaust.length > 0 ? Math.round(percentile(sortedExhaust, 0.5)) : null,
    expectedBufferAtHorizon: Math.round(percentile(finalCol, 0.5)),
    severity: severityOf(probabilityOfFailure),
    drivers: [],
    paths,
    seed,
  };
}

export function explainRisk(
  twin: FinancialTwin,
  scenario: Scenario,
  result: SimulationResult,
): RiskDriver[] {
  const drivers: RiskDriver[] = [];
  const burn = twin.fixedExpenses + twin.variableExpenses + twin.emiMonthly;
  const runway = burn > 0 ? twin.cashBalance / burn : 99;
  const load = twin.monthlyIncome > 0 ? (twin.fixedExpenses + twin.emiMonthly) / twin.monthlyIncome : 0;

  drivers.push({
    label: 'Runway today',
    detail: `Your ₹${twin.cashBalance.toLocaleString('en-IN')} buffer covers ${runway.toFixed(1)} months at the current burn of ₹${Math.round(burn).toLocaleString('en-IN')}/mo.`,
  });
  if (load > 0.5) {
    drivers.push({
      label: 'Commitment load',
      detail: `Rent, bills and EMIs consume ${Math.round(load * 100)}% of income, leaving little slack if income dips.`,
    });
  }
  if (twin.incomeVolatility > 0 && twin.monthlyIncome > 0) {
    drivers.push({
      label: 'Income volatility',
      detail: `Observed income swings ±₹${twin.incomeVolatility.toLocaleString('en-IN')}/mo (${Math.round((twin.incomeVolatility / twin.monthlyIncome) * 100)}%).`,
    });
  }

  const fastOpts = { paths: Math.min(result.paths, 1200), seed: result.seed ^ 0x9e3779b9 };
  const shockDeltas: { name: string; delta: number }[] = [];
  for (const s of scenario.shocks) {
    const reduced: Scenario = { ...scenario, shocks: scenario.shocks.filter((x) => x !== s) };
    const r2 = runSimulation(twin, reduced, fastOpts);
    shockDeltas.push({ name: describeShock(s), delta: result.probabilityOfFailure - r2.probabilityOfFailure });
  }
  shockDeltas.sort((a, b) => b.delta - a.delta);
  for (const d of shockDeltas.slice(0, 3)) {
    if (d.delta > 0.005) {
      drivers.push({
        label: d.name,
        detail: `Removing this shock lowers failure probability by ${(d.delta * 100).toFixed(0)} pp (from ${(result.probabilityOfFailure * 100).toFixed(0)}% to ${((result.probabilityOfFailure - d.delta) * 100).toFixed(0)}%).`,
      });
    }
  }
  return drivers;
}

export function runSimulationExplained(
  twin: FinancialTwin,
  scenario: Scenario,
  opts?: { paths?: number; seed?: number },
): SimulationResult {
  const result = runSimulation(twin, scenario, opts);
  result.drivers = explainRisk(twin, scenario, result);
  return result;
}
