import type { Transaction } from './types';

export interface ParseResult {
  transactions: Transaction[];
  warnings: string[];
}

const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[₹,\s]/g, '');
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  const n = Number(s);
  return Number.isFinite(n) ? sign * n : null;
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
  if (m) {
    const day = m[1].padStart(2, '0');
    const mon = m[2].padStart(2, '0');
    if (Number(mon) >= 1 && Number(mon) <= 12 && Number(day) <= 31) return `${m[3]}-${mon}-${day}`;
  }
  m = /^(\d{1,2})[\/\-.]([A-Za-z]{3,})[\/\-.](\d{4})$/.exec(s);
  if (m) {
    const mon = MONTH_ABBR[m[2].slice(0, 3).toLowerCase()];
    if (mon) return `${m[3]}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function detectDelimiter(header: string): string {
  const counts = [',', ';', '\t', '|'].map((d) => ({ d, n: header.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ',';
}

export function parseBankCsv(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^#/.test(l));
  if (lines.length < 2) {
    return { transactions: [], warnings: ['File appears empty or has no data rows.'] };
  }

  const delim = detectDelimiter(lines[0]);
  const header = splitLine(lines[0], delim).map((h) => h.toLowerCase());

  const findCol = (patterns: RegExp[]): number => {
    for (const p of patterns) {
      const idx = header.findIndex((h) => p.test(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateCol = findCol([/date/, /day/]);
  const descCol = findCol([/description|narration|details|particulars|remarks|merchant|payee/]);
  const amountCol = findCol([/^amount$/, /amount|value/]);
  const withdrawalCol = findCol([/withdrawal|debit/]);
  const depositCol = findCol([/deposit|credit/]);
  const typeCol = findCol([/type|dr\/cr|direction/]);

  if (dateCol === -1 || (amountCol === -1 && withdrawalCol === -1)) {
    return {
      transactions: [],
      warnings: [
        'Could not find date and amount columns. Expected headers like "date", "description", "amount" (or "withdrawal"/"deposit").',
      ],
    };
  }

  const transactions: Transaction[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    if (cells.length < Math.max(dateCol + 1, amountCol + 1, withdrawalCol + 1)) {
      skipped++;
      continue;
    }
    const date = parseDate(cells[dateCol]);
    if (!date) {
      skipped++;
      continue;
    }
    const description =
      descCol !== -1 && cells[descCol] ? cells[descCol] : 'Unknown transaction';

    let amount: number | null = null;
    if (amountCol !== -1) {
      amount = parseAmount(cells[amountCol]);
      if (amount !== null && amount > 0 && typeCol !== -1) {
        const t = cells[typeCol].toLowerCase();
        if (/^(dr|debit|withdrawal|-)/.test(t)) amount = -Math.abs(amount);
      }
    } else {
      const wd = parseAmount(cells[withdrawalCol]);
      const dp = depositCol !== -1 ? parseAmount(cells[depositCol]) : null;
      if ((wd === null || wd === 0) && dp !== null && dp > 0) amount = dp;
      else if (wd !== null) amount = -Math.abs(wd);
      else if (dp !== null) amount = dp;
    }

    if (amount === null || amount === 0) {
      skipped++;
      continue;
    }

    transactions.push({
      id: `csv-${i}`,
      date,
      description: description.replace(/\s+/g, ' ').slice(0, 80),
      amount: Math.round(amount * 100) / 100,
    });
    if (transactions.length >= 5000) break;
  }

  if (skipped > 0) warnings.push(`${skipped} row(s) skipped — missing or unparseable date/amount.`);
  if (transactions.length === 0)
    warnings.push('No valid transactions found. Check the column headers.');

  transactions.sort((a, b) => a.date.localeCompare(b.date));
  return { transactions, warnings };
}
