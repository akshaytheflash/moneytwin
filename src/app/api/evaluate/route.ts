import { ok, serverError } from '@/lib/api/http';
import { runEvaluation } from '@/lib/engine/evaluate';

export const maxDuration = 60;

export async function GET() {
  try {
    const report = runEvaluation(20);
    return ok({ report });
  } catch (err) {
    return serverError(err);
  }
}
