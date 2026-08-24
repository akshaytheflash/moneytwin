export type Category =
  | 'income'
  | 'rent'
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'shopping'
  | 'entertainment'
  | 'subscriptions'
  | 'utilities'
  | 'health'
  | 'education'
  | 'debt_emi'
  | 'insurance'
  | 'transfers'
  | 'other';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: Category;
}

export type RecurringKind = 'income' | 'fixed_expense' | 'debt';

export interface RecurringItem {
  id: string;
  name: string;
  kind: RecurringKind;
  category: Category;
  monthlyAmount: number;
  dayOfMonth: number | null;
  occurrences: number;
  confidence: number;
}

export interface CategorySummary {
  category: Category;
  monthlyAvg: number;
  share: number;
}

export interface TwinFlag {
  kind: 'thin_buffer' | 'volatile_income' | 'dangerous_commitment';
  message: string;
}

export interface FinancialTwin {
  label: string;
  source: 'demo' | 'csv' | 'manual';
  generatedAt: string;
  monthsObserved: number;
  cashBalance: number;
  monthlyIncome: number;
  incomeVolatility: number;
  fixedExpenses: number;
  variableExpenses: number;
  discretionaryMonthly: number;
  emiMonthly: number;
  emergencyBufferTarget: number;
  recurring: RecurringItem[];
  categories: CategorySummary[];
  flags: TwinFlag[];
}

export type ShockType =
  | 'income_drop_pct'
  | 'income_loss'
  | 'salary_delay'
  | 'one_time_expense'
  | 'recurring_increase'
  | 'new_emi';

export interface Shock {
  id: ShockType;
  pct?: number;
  amount?: number;
  months?: number;
  startMonth?: number;
  days?: number;
  name?: string;
}

export interface Scenario {
  shocks: Shock[];
  horizonMonths: number;
}

export interface MonthlyPoint {
  month: number;
  p05: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  failureProb: number;
}

export interface RiskDriver {
  label: string;
  detail: string;
}

export type Severity = 'low' | 'moderate' | 'high' | 'critical';

export interface SimulationResult {
  points: MonthlyPoint[];
  probabilityOfFailure: number;
  medianMinBalance: number;
  worstCaseMinBalance: number;
  medianExhaustionMonth: number | null;
  expectedBufferAtHorizon: number;
  severity: Severity;
  drivers: RiskDriver[];
  paths: number;
  seed: number;
}
