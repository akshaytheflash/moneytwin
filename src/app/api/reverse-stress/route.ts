import { ApiError, assert, badRequest, ok, readJson, serverError } from '@/lib/api/http';
import { findBreakingPoint } from '@/lib/engine/reverse';
import type { FinancialTwin, ShockType } from '@/lib/engine/types';

const VALID: ShockType[] = [
  'income_drop_pct',
  'income_loss',
  'salary_delay',
  'one_time_expense',
  'recurring_increase',
  'new_emi',
];

interface ReverseRequest {
  twin: FinancialTwin;
  template: { id: ShockType };
  horizonMonths: number;
}

export async function POST(req: Request) {
  try {
    const body = await readJson<ReverseRequest>(req);
    const t = body.twin;
    assert(t && typeof t === 'object', 'twin is required');
    assert(typeof t.cashBalance === 'number' && t.cashBalance >= 0, 'twin.cashBalance invalid');
    assert(
      body.template && VALID.includes(body.template.id),
      'template.id must be a valid shock type',
    );
    assert(
      body.horizonMonths === 3 || body.horizonMonths === 6 || body.horizonMonths === 12,
      'horizonMonths must be 3, 6 or 12',
    );

    const result = findBreakingPoint(
      t,
      { id: body.template.id },
      body.horizonMonths,
    );
    if (!result) return badRequest('This shock type cannot be scaled to find a breaking point.');
    return ok({ breakingPoint: result });
  } catch (err) {
    if (err instanceof ApiError) return badRequest(err.message);
    return serverError(err);
  }
}
