import { categorizeDescription } from './categorize';
import type { Category, RecurringItem, RecurringKind, Transaction } from './types';

function normalizeKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/[0-9]+/g, '#')
    .replace(/[^a-z#]/g, '')
    .slice(0, 24);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / 86400000);
}

export function detectRecurring(txns: Transaction[]): RecurringItem[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    if (t.category === 'transfers') continue;
    const key = `${normalizeKey(t.description)}|${t.amount >= 0 ? 'cr' : 'dr'}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }

  const items: RecurringItem[] = [];
  for (const [key, list] of groups) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (avg < 100) continue;
    const variance =
      amounts.reduce((a, b) => a + (b - avg) * (b - avg), 0) / amounts.length;
    const cv = Math.sqrt(variance) / avg;

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++)
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    const medianGap = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 30;
    const monthlyLike = medianGap >= 24 && medianGap <= 38;

    let dayHits = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (new Date(sorted[i].date).getDate() === new Date(sorted[0].date).getDate()) dayHits++;
    }
    const dayRegular = sorted.length > 2 && dayHits >= Math.ceil(sorted.length / 2);

    const spanDays = daysBetween(sorted[0].date, sorted[sorted.length - 1].date);
    const expectedInSpan = spanDays / 30.4;
    const coverage = list.length / Math.max(expectedInSpan, 1);

    if (!monthlyLike && !dayRegular) continue;
    if (cv > 0.25) continue;

    let confidence = 0.4 + 0.3 * coverage + 0.2 * (1 - cv * 2) + (dayRegular ? 0.1 : 0);
    confidence = Math.min(0.99, Math.max(0, confidence));

    const first = sorted[0];
    const resolvedCategory: Category = first.category ?? categorizeDescription(first.description);    const kind: RecurringKind =
      first.amount >= 0 ? 'income' : resolvedCategory === 'debt_emi' ? 'debt' : 'fixed_expense';
    const category: Category =
      kind === 'income' ? 'income' : resolvedCategory;

    items.push({
      id: `rec-${key}`,
      name: first.description.replace(/\s+/g, ' ').trim().slice(0, 40),
      kind,
      category,
      monthlyAmount: Math.round(avg),
      dayOfMonth: monthlyLike ? new Date(first.date).getDate() : null,
      occurrences: list.length,
      confidence: Number(confidence.toFixed(2)),
    });
  }
  return items.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}
