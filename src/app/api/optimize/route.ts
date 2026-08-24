import { ApiError, assert, badRequest, ok, readJson, serverError } from '@/lib/api/http';
import { optimizeInterventions } from '@/lib/engine/interventions';
import type { FinancialTwin, Scenario } from '@/lib/engine/types';

interface OptimizeRequest {
  twin: FinancialTwin;
  scenario: { shocks: Scenario['shocks']; horizonMonths: number };
  targetProbability?: number;
}

export async function POST(req: Request) {
  try {
    const body = await readJson<OptimizeRequest>(req);
    const t = body.twin;
    assert(t && typeof t === 'object', 'twin is required');
    assert(typeof t.cashBalance === 'number' && t.cashBalance >= 0, 'twin.cashBalance invalid');
    const s = body.scenario;
    assert(s && Array.isArray(s.shocks) && s.shocks.length > 0, 'scenario with at least one shock required');
    assert(s.horizonMonths === 3 || s.horizonMonths === 6 || s.horizonMonths === 12, 'horizonMonths must be 3, 6 or 12');

    let target = body.targetProbability ?? 0.1;
    assert(typeof target === 'number' && target >= 0.01 && target <= 0.5, 'targetProbability must be between 0.01 and 0.5');
    target = Math.round(target * 1000) / 1000;

    const result = optimizeInterventions(
      t,
      { shocks: s.shocks, horizonMonths: s.horizonMonths },
      target,
    );
    return ok({ optimize: result });
  } catch (err) {
    if (err instanceof ApiError) return badRequest(err.message);
    return serverError(err);
  }
}
