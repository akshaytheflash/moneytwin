import type { Transaction } from './types';

export interface DemoProfileMeta {
  id: string;
  label: string;
  tagline: string;
  cashBalance: number;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthStart(monthsAgo: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
}

let txnCounter = 0;
function txn(date: Date, description: string, amount: number): Transaction {
  txnCounter += 1;
  return {
    id: `demo-${txnCounter}`,
    date: iso(date),
    description,
    amount: Math.round(amount),
  };
}

interface Persona {
  id: string;
  label: string;
  tagline: string;
  seed: number;
  cashBalance: number;
  historyMonths: number;
  incomes: { name: string; amount: number; day: number; jitter: number }[];
  emis: { name: string; amount: number; day: number }[];
  rent?: { name: string; amount: number; day: number };
  utilities: { amount: number };
  groceries: { trips: number; perTrip: number };
  dining: { orders: number; perOrder: number };
  transport: { rides: number; perRide: number };
  subscriptions: { name: string; amount: number }[];
  shopping: { orders: number; perOrder: number };
  incomeMultiplier?: (m: number) => number;
}

const PERSONAS: Persona[] = [
  {
    id: 'meera',
    label: 'Meera · Salaried designer',
    tagline: 'Stable salary, one bike EMI, comfortable but lightly buffered.',
    seed: 20260101,
    cashBalance: 210000,
    historyMonths: 8,
    incomes: [{ name: 'SALARY CREDIT STUDIO NOVA', amount: 92000, day: 1, jitter: 1 }],
    emis: [{ name: 'BIKE LOAN EMI HDFC', amount: 8500, day: 5 }],
    rent: { name: 'RENT UPI LANDLORD KORAMANGALA', amount: 24000, day: 3 },
    utilities: { amount: 3200 },
    groceries: { trips: 4, perTrip: 2300 },
    dining: { orders: 7, perOrder: 850 },
    transport: { rides: 8, perRide: 420 },
    subscriptions: [
      { name: 'NETFLIX SUBSCRIPTION', amount: 649 },
      { name: 'SPOTIFY PREMIUM', amount: 149 },
      { name: 'PRIME VIDEO', amount: 299 },
    ],
    shopping: { orders: 2, perOrder: 2200 },
  },
  {
    id: 'arjun',
    label: 'Arjun · Freelance developer',
    tagline: 'High average income but lumpy client payments and zero discipline buffer.',
    seed: 20260202,
    cashBalance: 90000,
    historyMonths: 8,
    incomes: [{ name: 'NEFT CLIENT INVOICE PAYMENT', amount: 104000, day: 7, jitter: 4 }],
    emis: [],
    rent: { name: 'PG RENT INDIRANAGAR', amount: 18000, day: 4 },
    utilities: { amount: 2600 },
    groceries: { trips: 3, perTrip: 1900 },
    dining: { orders: 12, perOrder: 780 },
    transport: { rides: 14, perRide: 380 },
    subscriptions: [
      { name: 'CHATGPT PLUS SUBSCRIPTION', amount: 1999 },
      { name: 'NOTION SAAS', amount: 800 },
      { name: 'YOUTUBE PREMIUM', amount: 149 },
    ],
    shopping: { orders: 3, perOrder: 3400 },
    incomeMultiplier: (m) => [1.45, 0.52, 1.15, 1.62, 0.58, 1.22, 0.94, 0.47][m % 8],
  },
  {
    id: 'rao',
    label: 'Rao household · Dual income, two EMIs',
    tagline: 'Home loan plus car loan, school fees — high commitment load, thin slack.',
    seed: 20260303,
    cashBalance: 120000,
    historyMonths: 8,
    incomes: [
      { name: 'SALARY CREDIT INFOTECH LTD', amount: 98000, day: 1, jitter: 1 },
      { name: 'SALARY CREDIT SUNRISE SCHOOL', amount: 47000, day: 2, jitter: 1 },
    ],
    emis: [
      { name: 'HOME LOAN EMI LIC HOUSING', amount: 52000, day: 7 },
      { name: 'CAR LOAN EMI ICICI', amount: 14000, day: 10 },
    ],
    rent: { name: 'SOCIETY MAINTENANCE CHARGE', amount: 4500, day: 5 },
    utilities: { amount: 5200 },
    groceries: { trips: 6, perTrip: 2350 },
    dining: { orders: 6, perOrder: 1150 },
    transport: { rides: 5, perRide: 350 },
    subscriptions: [
      { name: 'NETFLIX SUBSCRIPTION', amount: 649 },
      { name: 'JIO CINEMA', amount: 199 },
    ],
    shopping: { orders: 3, perOrder: 2000 },
  },
];

export const DEMO_PROFILES: DemoProfileMeta[] = PERSONAS.map((p) => ({
  id: p.id,
  label: p.label,
  tagline: p.tagline,
  cashBalance: p.cashBalance,
}));

export function generateDemoTransactions(profileId: string): { meta: DemoProfileMeta; transactions: Transaction[]; cashBalance: number } {
  const persona = PERSONAS.find((p) => p.id === profileId);
  if (!persona) throw new Error(`Unknown profile ${profileId}`);
  const rand = (() => {
    let a = persona.seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  txnCounter = 0;
  const txns: Transaction[] = [];
  const jitterDay = (day: number, max: number) => Math.min(28, Math.max(1, day + Math.floor(rand() * (max * 2 + 1)) - max));

  for (let m = persona.historyMonths; m >= 1; m--) {
    const start = monthStart(m);

    for (const inc of persona.incomes) {
      const mult = persona.incomeMultiplier ? persona.incomeMultiplier(persona.historyMonths - m) : 1;
      const noise = inc.jitter > 0 ? 1 + (rand() * 2 - 1) * inc.jitter * 0.02 : 1;
      const d = new Date(start);
      d.setUTCDate(jitterDay(inc.day, 2));
      txns.push(txn(d, inc.name, inc.amount * mult * noise));
    }
    if (persona.rent) {
      const d = new Date(start);
      d.setUTCDate(jitterDay(persona.rent.day, 1));
      txns.push(txn(d, persona.rent.name, -persona.rent.amount * (1 + (rand() * 2 - 1) * 0.01)));
    }
    for (const emi of persona.emis) {
      const d = new Date(start);
      d.setUTCDate(jitterDay(emi.day, 1));
      txns.push(txn(d, emi.name, -emi.amount));
    }
    {
      const d = new Date(start);
      d.setUTCDate(Math.floor(8 + rand() * 14));
      txns.push(txn(d, 'BESCOM ELECTRICITY BILL PAY', -persona.utilities.amount * (0.75 + rand() * 0.6)));
    }
    for (let i = 0; i < persona.groceries.trips; i++) {
      const d = new Date(start);
      d.setUTCDate(Math.floor(1 + rand() * 27));
      txns.push(
        txn(
          d,
          ['BLINKIT GROCERY ORDER', 'BIGBASKET DELIVERY', 'DMART STORE PURCHASE', 'ZEPTO DAILY NEEDS'][Math.floor(rand() * 4)],
          -persona.groceries.perTrip * (0.6 + rand() * 0.9),
        ),
      );
    }
    for (let i = 0; i < persona.dining.orders; i++) {
      const d = new Date(start);
      d.setUTCDate(Math.floor(1 + rand() * 27));
      txns.push(
        txn(
          d,
          ['SWIGGY ORDER FOOD DELIVERY', 'ZOMATO FOOD DELIVERY', 'THIRD WAVE COFFEE ROASTERS', 'TOIT BREWERY'][Math.floor(rand() * 4)],
          -persona.dining.perOrder * (0.5 + rand() * 1.2),
        ),
      );
    }
    for (let i = 0; i < persona.transport.rides; i++) {
      const d = new Date(start);
      d.setUTCDate(Math.floor(1 + rand() * 27));
      txns.push(
        txn(
          d,
          ['UBER RIDE TRIP', 'OLA CABS BOOKING', 'RAPIDO BIKE TAXI', 'FASTAG TOLL DEBIT'][Math.floor(rand() * 4)],
          -persona.transport.perRide * (0.5 + rand() * 1.3),
        ),
      );
    }
    for (const sub of persona.subscriptions) {
      const d = new Date(start);
      d.setUTCDate(jitterDay(6, 2));
      txns.push(txn(d, sub.name, -sub.amount));
    }
    for (let i = 0; i < persona.shopping.orders; i++) {
      const d = new Date(start);
      d.setUTCDate(Math.floor(1 + rand() * 27));
      txns.push(
        txn(
          d,
          ['AMAZON.IN ORDER', 'FLIPKART SHOPPING', 'MYNTRA FASHION', 'CROMA ELECTRONICS'][Math.floor(rand() * 4)],
          -persona.shopping.perOrder * (0.4 + rand() * 1.4),
        ),
      );
    }
    if (rand() < 0.35) {
      const d = new Date(start);
      d.setUTCDate(Math.floor(1 + rand() * 27));
      txns.push(txn(d, 'APOLLO PHARMACY MEDICAL', -(800 + rand() * 2500)));
    }
  }

  const meta = DEMO_PROFILES.find((d) => d.id === profileId)!;
  return { meta, transactions: txns, cashBalance: persona.cashBalance };
}
