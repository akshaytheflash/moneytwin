import { describeShock, runSimulation } from './forecast';
import { hashSeed } from './rng';
import type { FinancialTwin, Shock, ShockType } from './types';

export interface BreakingPoint {
  templateId: ShockType;
  largestSurvivable: Shock | null;
  breakingShock: Shock;
  message: string;
}

interface Bound {
  param: 'pct' | 'amount' | 'days' | 'months';
  lo: number;
  hi: number;
}

function boundsFor(
  id: ShockType,
  twin: FinancialTwin,
  horizon: number,
): Bound | null {
  const burn = twin.fixedExpenses + twin.variableExpenses + twin.emiMonthly;
  switch (id) {
    case 'income_drop_pct':
      return { param: 'pct', lo: 5, hi: 95 };
    case 'one_time_expense':
      return {
        param: 'amount',
        lo: 1000,
        hi: Math.max(twin.cashBalance * 4, burn * 8, 100000),
      };
    case 'new_emi':
      return {
        param: 'amount',
        lo: 1000,
        hi: Math.max(Math.round(twin.monthlyIncome * 0.6), 5000),
      };
    case 'recurring_increase':
      return { param: 'amount', lo: 500, hi: Math.max(burn, 5000) };
    case 'salary_delay':
      return { param: 'days', lo: 1, hi: 60 };
    case 'income_loss':
      return { param: 'months', lo: 1, hi: horizon };
    default:
      return null;
  }
}

function atMagnitude(template: Shock, bound: Bound, value: number): Shock {
  const v =
    bound.param === 'amount'
      ? Math.round(value / 500) * 500
      : bound.param === 'pct'
        ? Math.round(value)
        : Math.round(value);
  return { ...template, [bound.param]: Math.max(v, 1) } as Shock;
}

export function findBreakingPoint(
  twin: FinancialTwin,
  template: Shock,
  horizon: number,
  opts?: { paths?: number },
): BreakingPoint | null {
  const bound = boundsFor(template.id, twin, horizon);
  if (!bound) return null;

  const paths = opts?.paths ?? 700;
  const seed = hashSeed(`break|${twin.label}|${template.id}|${horizon}`) ^ 0x51ed5eed;
  const failProb = (s: Shock) =>
    runSimulation(twin, { shocks: [s], horizonMonths: horizon }, { paths, seed })
      .probabilityOfFailure;

  const THRESHOLD = 0.5;
  let largestSurvivable: Shock | null = null;

  const integerParams = bound.param === 'days' || bound.param === 'months';
  if (integerParams) {
    for (let v = bound.lo; v <= bound.hi; v++) {
      const s = atMagnitude(template, bound, v);
      if (failProb(s) < THRESHOLD) largestSurvivable = s;
      else break;
    }
    if (!largestSurvivable) {
      const breaking = atMagnitude(template, bound, bound.lo);
      return {
        templateId: template.id,
        largestSurvivable: null,
        breakingShock: breaking,
        message: `Even the smallest version of this shock (${describeShock(breaking)}) pushes you past a 50% chance of running out of money. Your buffer needs attention first.`,
      };
    }
    if (largestSurvivable[bound.param] === bound.hi) {
      const breaking = atMagnitude(template, bound, bound.hi);
      return {
        templateId: template.id,
        largestSurvivable,
        breakingShock: breaking,
        message: `Remarkably resilient: you'd weather even ${describeShock(atMagnitude(template, bound, bound.hi))} — the largest version we test.`,
      };
    }
    const breaking = atMagnitude(
      template,
      bound,
      (largestSurvivable[bound.param] as number) + 1,
    );
    return {
      templateId: template.id,
      largestSurvivable,
      breakingShock: breaking,
      message: `You can absorb ${describeShock(largestSurvivable)}. One notch more — ${describeShock(breaking)} — crosses a 50% chance of liquidity failure.`,
    };
  }

  const loFail = failProb(atMagnitude(template, bound, bound.lo));
  if (loFail >= THRESHOLD) {
    const breaking = atMagnitude(template, bound, bound.lo);
    return {
      templateId: template.id,
      largestSurvivable: null,
      breakingShock: breaking,
      message: `Even the smallest version of this shock (${describeShock(breaking)}) pushes you past a 50% chance of running out of money. Your buffer needs attention first.`,
    };
  }

  let lo = bound.lo;
  let hi = bound.hi;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    if (failProb(atMagnitude(template, bound, mid)) < THRESHOLD) lo = mid;
    else hi = mid;
  }
  largestSurvivable = atMagnitude(template, bound, lo);

  if (lo >= bound.hi - 1e-6) {
    return {
      templateId: template.id,
      largestSurvivable,
      breakingShock: atMagnitude(template, bound, bound.hi),
      message: `Remarkably resilient: you'd weather even ${describeShock(atMagnitude(template, bound, bound.hi))} — the largest version we test.`,
    };
  }

  const breaking = atMagnitude(template, bound, hi);
  return {
    templateId: template.id,
    largestSurvivable,
    breakingShock: breaking,
    message: `You can absorb ${describeShock(largestSurvivable)}. Beyond that — ${describeShock(breaking)} and worse — the odds of running out of money tip past 50%.`,
  };
}
