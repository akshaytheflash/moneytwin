import { DEMO_PROFILES } from '@/lib/engine/demo';
import { ok, serverError } from '@/lib/api/http';

export async function GET() {
  try {
    return ok({ profiles: DEMO_PROFILES });
  } catch (err) {
    return serverError(err);
  }
}
