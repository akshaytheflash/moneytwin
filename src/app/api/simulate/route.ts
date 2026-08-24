import { ApiError, assert, badRequest, ok, readJson, serverError } from '@/lib/api/http';
import { runSimulationExplained } from '@/lib/engine/forecast';
import type { FinancialTwin, Scenario } from '@/lib/engine/types';

const VALID_SHOCKS = new Set([
  'income_drop_pct',
  'income_loss',
  'salary_delay',
  'one_time_expense',
  'recurring_increase',
  'new_emi',
]);

interface SimulateRequest {
  twin: FinancialTwin;
  scenario: { shocks: Scenario['shocks']; horizonMonths: number };
  seed?: number;
}

function validateTwin(t: FinancialTwin | undefined): asserts t is FinancialTwin {
  assert(t && typeof t === 'object', 'twin is required');
  assert(typeof t.cashBalance === 'number' && t.cashBalance >= 0, 'twin.cashBalance must be a non-negative number');
  assert(typeof t.monthlyIncome === 'number' && t.monthlyIncome >= 0, 'twin.monthlyIncome must be a non-negative number');
  assert(typeof t.fixedExpenses === 'number' && t.fixedExpenses >= 0, 'twin.fixedExpenses must be non-negative');
  assert(typeof t.variableExpenses === 'number' && t.variableExpenses >= 0, 'twin.variableExpenses must be non-negative');
  assert(typeof t.emiMonthly === 'number' && t.emiMonthly >= 0, 'twin.emiMonthly must be non-negative');
}

function validateScenario(s: SimulateRequest['scenario']): asserts s is Scenario {
  assert(s && typeof s === 'object', 'scenario is required');
  assert(Array.isArray(s.shocks), 'scenario.shocks must be an array');
  assert(
    s.horizonMonths === 3 || s.horizonMonths === 6 || s.horizonMonths === 12,
    'horizonMonths must be 3, 6 or 12',
  );
  for (const sh of s.shocks) {
    assert(sh && typeof sh === 'object' && VALID_SHOCKS.has(sh.id), `Unknown shock type`);
    if (sh.startMonth !== undefined) assert(sh.startMonth >= 1 && sh.startMonth <= s.horizonMonths, 'startMonth out of range');
    if (sh.amount !== undefined) assert(typeof sh.amount === 'number' && sh.amount > 0, 'shock amount must be positive');
    if (sh.pct !== undefined) assert(sh.pct >= 1 && sh.pct <= 100, 'pct must be between 1 and 100');
    if (sh.days !== undefined) assert(sh.days >= 1 && sh.days <= 60, 'days must be between 1 and 60');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson<SimulateRequest>(req);
    validateTwin(body.twin);
    validateScenario(body.scenario);

    const scenario: Scenario = {
      horizonMonths: body.scenario.horizonMonths,
      shocks: body.scenario.shocks,
    };
    const baseline = runSimulationExplained(body.twin, { ...scenario, shocks: [] }, { seed: body.seed });
    const stressed =
      scenario.shocks.length > 0
        ? runSimulationExplained(body.twin, scenario, { seed: body.seed })
        : baseline;

    return ok({ baseline, stressed });
  } catch (err) {
    if (err instanceof ApiError) return badRequest(err.message);
    return serverError(err);
  }
}
