import { runSimulation } from './forecast';
import type { FinancialTwin, Scenario } from './types';

export interface Intervention {
  id: string;
  name: string;
  description: string;
  monthlySacrifice: number;
  apply(twin: FinancialTwin, scenario: Scenario): { twin: FinancialTwin; scenario: Scenario };
}

export function buildInterventionCatalog(
  twin: FinancialTwin,
): Intervention[] {
  const catalog: Intervention[] = [];
  const disc = twin.discretionaryMonthly;

  if (disc >= 1000) {
    for (const pct of [20, 40]) {
      const cut = Math.round(disc * (pct / 100));
      if (cut < 500) continue;
      catalog.push({
        id: `cut_discretionary_${pct}`,
        name: `Trim discretionary spend ${pct}%`,
        description: `Cut ₹${cut.toLocaleString('en-IN')}/mo from food delivery, shopping and subscriptions.`,
        monthlySacrifice: cut,
        apply: (t, s) => ({
          twin: {
            ...t,
            discretionaryMonthly: t.discretionaryMonthly - cut,
            variableExpenses: Math.max(0, t.variableExpenses - cut),
          },
          scenario: s,
        }),
      });
    }
  }

  const subs = twin.categories.find((c) => c.category === 'subscriptions');
  if (subs && subs.monthlyAvg >= 400) {
    const amt = subs.monthlyAvg;
    catalog.push({
      id: 'cancel_subscriptions',
      name: 'Cancel non-essential subscriptions',
      description: `Drop ₹${amt.toLocaleString('en-IN')}/mo of streaming and app subscriptions.`,
      monthlySacrifice: amt,
      apply: (t, s) => ({
        twin: {
          ...t,
          discretionaryMonthly: Math.max(0, t.discretionaryMonthly - amt),
          variableExpenses: Math.max(0, t.variableExpenses - amt),
          categories: t.categories.map((c) =>
            c.category === 'subscriptions' ? { ...c, monthlyAvg: 0 } : c,
          ),
        },
        scenario: s,
      }),
    });
  }

  const reserveBig = Math.min(
    100000,
    Math.max(25000, Math.round(twin.emergencyBufferTarget * 0.3 / 5000) * 5000),
  );
  const reserveTiers = [...new Set([15000, 30000, reserveBig])];
  for (const reserve of reserveTiers) {
    if (reserve >= twin.cashBalance * 8) continue;
    catalog.push({
      id: `build_reserve_${reserve}`,
      name: `Build ₹${reserve.toLocaleString('en-IN')} emergency reserve`,
      description: `Move ₹${reserve.toLocaleString('en-IN')} from long-term savings into the liquid buffer today.`,
      monthlySacrifice: Math.round(reserve * 0.03),
      apply: (t, s) => ({ twin: { ...t, cashBalance: t.cashBalance + reserve }, scenario: s }),
    });
  }

  if (twin.emiMonthly >= 3000) {
    const relief = Math.round(twin.emiMonthly * 0.22);
    catalog.push({
      id: 'refinance_emi',
      name: 'Refinance / extend loan tenure',
      description: `Restructure EMIs to free ₹${relief.toLocaleString('en-IN')}/mo (more interest paid over time).`,
      monthlySacrifice: 0,
      apply: (t, s) => ({
        twin: { ...t, emiMonthly: t.emiMonthly - relief },
        scenario: s,
      }),
    });
  }

  return catalog;
}

export interface LadderStep {
  interventionId: string;
  name: string;
  description: string;
  riskBefore: number;
  riskAfter: number;
  marginalGain: number;
  cumulativeRisk: number;
}

export interface OptimizeResult {
  baselineRisk: number;
  targetProbability: number;
  alreadyMet: boolean;
  steps: LadderStep[];
  finalRisk: number;
  achievedTarget: boolean;
  totalMonthlySacrifice: number;
  appliedTwins: FinancialTwin;
}

export function optimizeInterventions(
  twin: FinancialTwin,
  scenario: Scenario,
  targetProbability: number,
  opts?: { paths?: number; evalPaths?: number },
): OptimizeResult {
  const paths = opts?.paths ?? 1600;
  const evalPaths = opts?.evalPaths ?? 2400;
  const seedBase = 0x5eed0001;

  const base = runSimulation(twin, scenario, { paths: evalPaths, seed: seedBase });
  const baselineRisk = base.probabilityOfFailure;

  if (baselineRisk <= targetProbability) {
    return {
      baselineRisk,
      targetProbability,
      alreadyMet: true,
      steps: [],
      finalRisk: baselineRisk,
      achievedTarget: true,
      totalMonthlySacrifice: 0,
      appliedTwins: twin,
    };
  }

  const catalog = buildInterventionCatalog(twin);
  const scored = catalog.map((iv) => {
    const { twin: t2, scenario: s2 } = iv.apply(twin, scenario);
    const r = runSimulation(t2, s2, { paths, seed: seedBase + 7 });
    return {
      iv,
      riskAfter: r.probabilityOfFailure,
      gain: baselineRisk - r.probabilityOfFailure,
    };
  });

  scored.sort((a, b) => {
    const effA = a.gain / Math.max(a.iv.monthlySacrifice, 250);
    const effB = b.gain / Math.max(b.iv.monthlySacrifice, 250);
    return effB - effA;
  });

  let curTwin = twin;
  let curScenario = scenario;
  let curRisk = baselineRisk;
  const steps: LadderStep[] = [];
  let sacrifice = 0;

  for (const s of scored.slice(0, 4)) {
    if (steps.length >= 4 || curRisk <= targetProbability) break;
    const applied = s.iv.apply(curTwin, curScenario);
    const r = runSimulation(applied.twin, applied.scenario, { paths: evalPaths, seed: seedBase });
    if (r.probabilityOfFailure >= curRisk - 0.002) continue;
    curTwin = applied.twin;
    curScenario = applied.scenario;
    const before = curRisk;
    curRisk = r.probabilityOfFailure;
    sacrifice += s.iv.monthlySacrifice;
    steps.push({
      interventionId: s.iv.id,
      name: s.iv.name,
      description: s.iv.description,
      riskBefore: before,
      riskAfter: curRisk,
      marginalGain: before - curRisk,
      cumulativeRisk: curRisk,
    });
  }

  if (curRisk > targetProbability) {
    const used = new Set(steps.map((st) => st.interventionId));
    for (const s of scored) {
      if (steps.length >= 4 || curRisk <= targetProbability) break;
      if (used.has(s.iv.id)) continue;
      used.add(s.iv.id);
      const applied = s.iv.apply(curTwin, curScenario);
      const r = runSimulation(applied.twin, applied.scenario, {
        paths: evalPaths,
        seed: seedBase,
      });
      if (r.probabilityOfFailure >= curRisk - 0.0005) continue;
      curTwin = applied.twin;
      curScenario = applied.scenario;
      const before = curRisk;
      curRisk = r.probabilityOfFailure;
      sacrifice += s.iv.monthlySacrifice;
      steps.push({
        interventionId: s.iv.id,
        name: s.iv.name,
        description: s.iv.description,
        riskBefore: before,
        riskAfter: curRisk,
        marginalGain: before - curRisk,
        cumulativeRisk: curRisk,
      });
    }
  }

  return {
    baselineRisk,
    targetProbability,
    alreadyMet: false,
    steps,
    finalRisk: curRisk,
    achievedTarget: curRisk <= targetProbability,
    totalMonthlySacrifice: sacrifice,
    appliedTwins: curTwin,
  };
}
