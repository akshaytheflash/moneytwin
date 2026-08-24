import { RULES } from './categories';
import type { Category, Transaction } from './types';

export function categorizeDescription(description: string): Category {
  for (const [category, re] of RULES) {
    if (re.test(description)) return category;
  }
  return 'other';
}

export function categorizeTransactions(txns: Transaction[]): Transaction[] {
  return txns.map((t) => ({ ...t, category: categorizeDescription(t.description) }));
}
