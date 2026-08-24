import { runSimulation } from './forecast';
import type { FinancialTwin, Scenario, Shock } from './types';
import { hashSeed, mulberry32 } from './rng';
import { optimizeInterventions } from './interventions';

export interface EvalReport {
  populationSize: number;
  calibration: {
    brier: number;
    mae: number;
    bins: { pHat: number; pEmp: number; n: number }[];
  };
  iqrCoverage: number;
  forecastErrorPct: number;
  interventionEffectiveness: {
    avgReductionPp: number;
    targetHitRate: number;
    monotonicViolations: number;
  };
  performanceMsPerSim: number;
  generatedAtMs: number;
}

function randomPopulation(n: number, seed: number): { twin: FinancialTwin; scenario: Scenario }[] {
  const rand = mulberry32(seed);
  const out: { twin: FinancialTwin; scenario: Scenario }[] = [];
  for (let i = 0; i < n; i++) {
    const income = Math.round(30000 + rand() * 120000);
    const cv = 0.05 + rand() * 0.5;
    const fixedRatio = 0.2 + rand() * 0.4;
    const fixed = Math.round(income * fixedRatio);
    const variable = Math.round(income * (0.1 + rand() * 0.35));
    const hasEmi = rand() < 0.6;
    const emi = hasEmi ? Math.round(income * (0.08 + rand() * 0.2)) : 0;
    const burn = fixed + variable + emi;
    const bufferMonths = 0.3 + rand() * 3.7;
    const cashBalance = Math.round(burn * bufferMonths);

    const twin: FinancialTwin = {
      label: `synthetic-${i + 1}`,
      source: 'demo',
      generatedAt: new Date().toISOString(),
      monthsObserved: 8,
      cashBalance,
      monthlyIncome: income,
      incomeVolatility: Math.round(cv * income),
      fixedExpenses: fixed,
      variableExpenses: variable,
      discretionaryMonthly: Math.round(variable * 0.6),
      emiMonthly: emi,
      emergencyBufferTarget: burn * 3,
      recurring: [],
      categories: [],
      flags: [],
    };

    const roll = rand();
    let shocks: Shock[];
    if (roll < 0.25) {
      shocks = [{ id: 'income_drop_pct', pct: Math.round(15 + rand() * 25), months: 6 }];
    } else if (roll < 0.45) {
      shocks = [{ id: 'one_time_expense', amount: Math.round(20000 + rand() * 80000), startMonth: 2 }];
    } else if (roll < 0.65) {
      shocks = [{ id: 'income_loss', months: 2 }];
    } else if (roll < 0.8) {
      shocks = [
        { id: 'income_drop_pct', pct: Math.round(10 + rand() * 15), months: 6 },
        { id: 'one_time_expense', amount: Math.round(15000 + rand() * 40000), startMonth: 3 },
      ];
    } else if (roll < 0.9) {
      shocks = [{ id: 'new_emi', amount: Math.round(5000 + rand() * 15000) }];
    } else {
      shocks = [{ id: 'salary_delay', days: 30 }, { id: 'recurring_increase', amount: Math.round(2000 + rand() * 6000), name: 'Rent hike' }];
    }

    out.push({ twin, scenario: { shocks, horizonMonths: 12 } });
  }
  return out;
}

export function runEvaluation(populationSize = 20): EvalReport {
  const t0 = Date.now();
  const pop = randomPopulation(populationSize, hashSeed('moneytwin-eval-v1'));

  let brierSum = 0;
  let maeSum = 0;
  let coverageHits = 0;
  let errSum = 0;
  let reductionSum = 0;
  let targetHits = 0;
  let monotonicViolations = 0;
  const bins = Array.from({ length: 5 }, (_, i) => ({
    lo: i * 0.2,
    hi: (i + 1) * 0.2,
    sumHat: 0,
    sumEmp: 0,
    n: 0,
  }));

  let simCount = 0;
  for (const { twin, scenario } of pop) {
    const pHat = runSimulation(twin, scenario, { paths: 500, seed: 1111 });
    simCount += 2;
    const pEmp = runSimulation(twin, scenario, { paths: 4000, seed: 2222 });
    simCount++;

    brierSum += (pHat.probabilityOfFailure - pEmp.probabilityOfFailure) ** 2;
    maeSum += Math.abs(pHat.probabilityOfFailure - pEmp.probabilityOfFailure);

    const bin = bins[Math.min(Math.floor(pHat.probabilityOfFailure / 0.2), 4)];
    bin.sumHat += pHat.probabilityOfFailure;
    bin.sumEmp += pEmp.probabilityOfFailure;
    bin.n++;

    const realizedMedian = pEmp.points[6].p50;
    if (realizedMedian >= pHat.points[6].p25 && realizedMedian <= pHat.points[6].p75)
      coverageHits++;

    const expectedApprox =
      twin.cashBalance +
      6 *
        (twin.monthlyIncome -
          twin.fixedExpenses -
          twin.variableExpenses -
          twin.emiMonthly);
    errSum +=
      expectedApprox !== 0
        ? Math.abs(expectedApprox - pHat.points[6].p50) /
          Math.max(twin.fixedExpenses + twin.variableExpenses + twin.emiMonthly, 1)
        : 0;

    const target = Math.min(pEmp.probabilityOfFailure * 0.5, 0.12);
    const opt = optimizeInterventions(twin, scenario, target, {
      paths: 600,
      evalPaths: 900,
    });
    simCount += 2 + opt.steps.length;
    if (!opt.alreadyMet) {
      const red = (opt.baselineRisk - opt.finalRisk) * 100;
      reductionSum += red;
      if (opt.finalRisk <= opt.baselineRisk - 0.001 || opt.steps.length === 0) {
        if (red < 0) monotonicViolations++;
      }
      if (opt.achievedTarget) targetHits++;
    }
  }

  return {
    populationSize,
    calibration: {
      brier: Number((brierSum / populationSize).toFixed(5)),
      mae: Number((maeSum / populationSize).toFixed(5)),
      bins: bins.map((b) => ({
        pHat: b.n ? Number((b.sumHat / b.n).toFixed(3)) : 0,
        pEmp: b.n ? Number((b.sumEmp / b.n).toFixed(3)) : 0,
        n: b.n,
      })),
    },
    iqrCoverage: Number((coverageHits / populationSize).toFixed(3)),
    forecastErrorPct: Number(((errSum / populationSize) * 100).toFixed(2)),
    interventionEffectiveness: {
      avgReductionPp: Number((reductionSum / populationSize).toFixed(1)),
      targetHitRate: Number((targetHits / populationSize).toFixed(2)),
      monotonicViolations,
    },
    performanceMsPerSim: Number(((Date.now() - t0) / Math.max(simCount, 1)).toFixed(2)),
    generatedAtMs: Date.now(),
  };
}
