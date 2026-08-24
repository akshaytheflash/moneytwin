import { ApiError, assert, badRequest, ok, readJson, serverError } from '@/lib/api/http';
import { generateDemoTransactions } from '@/lib/engine/demo';
import { parseBankCsv } from '@/lib/engine/parse';
import { buildTwinFromManual, buildTwinFromTransactions } from '@/lib/engine/twin';

interface TwinRequest {
  source: 'demo' | 'csv' | 'manual';
  profileId?: string;
  csv?: string;
  cashBalance?: number;
  label?: string;
  manual?: {
    monthlyIncome: number;
    incomeVolatilityPct: number;
    rent: number;
    utilities: number;
    otherFixed: number;
    emiMonthly: number;
    discretionaryMonthly: number;
    cashBalance: number;
  };
}

export async function POST(req: Request) {
  try {
    const body = await readJson<TwinRequest>(req);
    assert(body && typeof body === 'object', 'Invalid request body');

    if (body.source === 'demo') {
      assert(typeof body.profileId === 'string', 'profileId is required for demo profiles');
      const { meta, transactions, cashBalance } = generateDemoTransactions(body.profileId);
      const twin = buildTwinFromTransactions(transactions, {
        label: meta.label,
        source: 'demo',
        cashBalance,
      });
      return ok({ twin, transactions: transactions.length });
    }

    if (body.source === 'csv') {
      assert(typeof body.csv === 'string' && body.csv.length > 0, 'csv text is required');
      const parsed: ReturnType<typeof parseBankCsv> = parseBankCsv(body.csv.slice(0, 2_000_000));
      if (parsed.transactions.length < 5) {
        return badRequest('Could not extract enough transactions from the CSV.', parsed.warnings);
      }
      const twin = buildTwinFromTransactions(parsed.transactions, {
        label: body.label?.slice(0, 60) || 'Uploaded statement',
        source: 'csv',
        cashBalance: body.cashBalance,
      });
      return ok({ twin, warnings: parsed.warnings, transactions: parsed.transactions.length });
    }

    if (body.source === 'manual') {
      const m = body.manual;
      assert(m, 'manual inputs required');
      const nums = [m.monthlyIncome, m.incomeVolatilityPct, m.rent, m.utilities, m.otherFixed, m.emiMonthly, m.discretionaryMonthly, m.cashBalance];
      assert(nums.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0), 'All manual inputs must be non-negative numbers');
      assert(m.monthlyIncome > 0, 'Monthly income must be greater than zero');
      const twin = buildTwinFromManual({
        label: body.label?.slice(0, 60) || 'My finances',
        cashBalance: m.cashBalance,
        monthlyIncome: m.monthlyIncome,
        incomeVolatilityPct: m.incomeVolatilityPct,
        rent: m.rent,
        utilities: m.utilities,
        otherFixed: m.otherFixed,
        emiMonthly: m.emiMonthly,
        discretionaryMonthly: m.discretionaryMonthly,
      });
      return ok({ twin });
    }

    throw new ApiError('source must be one of: demo, csv, manual');
  } catch (err) {
    if (err instanceof ApiError) return badRequest(err.message);
    return serverError(err);
  }
}
