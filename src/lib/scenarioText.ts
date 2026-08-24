import type { Shock } from '@/lib/engine/types';

function parseRupees(raw: string): number | null {
  const s = raw.toLowerCase().replace(/[₹,\s]/g, '');
  const m = /^(\d+(?:\.\d+)?)(k|l|cr)?$/.exec(s);
  if (!m) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (m[2] === 'k') return n * 1000;
  if (m[2] === 'l') return n * 100000;
  if (m[2] === 'cr') return n * 10000000;
  return n;
}

export function parseScenarioText(text: string): Shock[] | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;
  const shocks: Shock[] = [];

  const monthsMatch = /(\d+)\s*(?:month|mo)s?/.exec(t);

  if (/(lose my job|job loss|lost my job|lose my income|no income|laid off|fired)/.test(t)) {
    shocks.push({ id: 'income_loss', months: monthsMatch ? Number(monthsMatch[1]) : 3 });
  }

  const drop = /income[^.]*?(?:drop|fall|down|reduce|cut)[^.]*?(\d{1,2})\s*%/.exec(t) ??
    /(\d{1,2})\s*%\s*(?:drop|cut|reduction)[^.]*?income/.exec(t);
  if (drop) {
    shocks.push({
      id: 'income_drop_pct',
      pct: Math.min(Number(drop[1]), 90),
      months: monthsMatch ? Number(monthsMatch[1]) : undefined,
    });
  }

  const delay = /(?:salary|pay)[^.]*?(?:delay|late)[^.]*?(\d{1,2})\s*days?/.exec(t) ??
    /(\d{1,2})\s*days?\s*(?:delay|late)/.exec(t);
  if (delay) {
    shocks.push({ id: 'salary_delay', days: Math.min(Number(delay[1]), 60) });
  }

  const expense = /(?:₹|rs\.?|inr)?\s*([\d,.]+\s*[klcr]?)(?:\s*rupees)?\s*(?:medical|hospital|emergency|one[- ]time|unexpected|repair)/.exec(t) ??
    /(?:medical|hospital|emergency|one[- ]time|unexpected|repair)\s*(?:expense|bill)?[^.]*?(?:of|₹|rs\.?)?\s*([\d,.]+\s*[klcr]?)/.exec(t);
  if (expense) {
    const amount = parseRupees(expense[1]);
    if (amount) shocks.push({ id: 'one_time_expense', amount, startMonth: 1 });
  }

  const emi = /new\s*emi[^.]*?(?:of|₹|rs\.?)?\s*([\d,.]+\s*[klcr]?)/.exec(t) ??
    /emi\s*(?:of|₹|rs\.?)\s*([\d,.]+\s*[klcr]?)\s*(?:starts|begin)/.exec(t);
  if (emi) {
    const amount = parseRupees(emi[1]);
    if (amount) shocks.push({ id: 'new_emi', amount });
  }

  const rent = /rent[^.]*?(?:hike|increase|up)[^.]*?(?:by|₹|rs\.?)?\s*([\d,.]+\s*[klcr]?)/.exec(t);
  if (rent) {
    const amount = parseRupees(rent[1]);
    if (amount) shocks.push({ id: 'recurring_increase', amount, name: 'Rent hike' });
  }

  return shocks.length > 0 ? shocks : null;
}
