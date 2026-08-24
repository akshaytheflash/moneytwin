import type { Category } from './types';

export const CATEGORY_LABELS: Record<Category, string> = {
  income: 'Income',
  rent: 'Rent & housing',
  groceries: 'Groceries',
  dining: 'Food delivery & dining',
  transport: 'Transport & fuel',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  subscriptions: 'Subscriptions',
  utilities: 'Utilities & bills',
  health: 'Health',
  education: 'Education',
  debt_emi: 'Loan EMI',
  insurance: 'Insurance',
  transfers: 'Transfers',
  other: 'Other',
};

export const DISCRETIONARY_CATEGORIES: Category[] = [
  'dining',
  'shopping',
  'entertainment',
  'subscriptions',
];

export const STRUCTURAL_CATEGORIES: Category[] = ['rent', 'utilities', 'insurance', 'education'];

type Rule = readonly [Category, RegExp];

export const RULES: Rule[] = [
  ['income', /(salary|sal cred|payroll|pay slip|wages?\b|stipend|pension|freelanc|consulting|honorarium|invoice pay)/i],
  ['debt_emi', /\b(emi|e\.?m\.?i|instl|instal?ment|loan (repay|payment|deb)|autopay loan)\b/i],
  ['subscriptions', /(netflix|spotify|prime ?video|hotstar|jio ?cinema|youtube ?premium|subscription|icloud|google one|adobe|notion|figma|chatgpt|openai|saas)/i],
  ['rent', /(rent|landlord|lease pay|pg (fee|rent)|society maintenance|maintenance charge)/i],
  ['utilities', /(electricity|power bill|bescom|water bill|gas bill|pip(ed)? gas|broadband|wifi|internet bill|act fibernet|airtel|jio fiber|vodafone|vi postpaid|bsnl|mobile (recharge|bill)|bill ?pay)/i],
  ['groceries', /(bigbasket|blinkit|zepto|dmart|instamart|grocer|kirana|supermarket|reliance fresh|more store|vegetable|fruits? shop|daily needs|rations?)/i],
  ['dining', /(swiggy|zomato|dominos|pizza|kfc|mcd|mac ?d|restaurant|cafe|coffee|starbucks|third wave|blue tokai|bar\b|brewery|dhaba|biryani|food court|eatfit|eatery)/i],
  ['transport', /(uber|ola(cabs|rides)?|rapido|metro rail|nmrc|fastag|toll|parking|irctc|redbus|fuel|petrol|diesel|indian ?oil|hp ?petrol|shell|bharat ?petrol)/i],
  ['health', /(apollo|pharmacy|pharmeasy|1 ?mg|hospital|clinic|diagnostic|lab test|medical|doctor|practo|dentist|optician)/i],
  ['education', /(coursera|udemy|tuition|school fee|college fee|course fee|byju|unacademy|textbook|udemy buy)/i],
  ['insurance', /(lic\b|insurance|policy premium|term plan|hdfc life|star health|icici pru|bajaj allianz)/i],
  ['shopping', /(amazon|flipkart|myntra|ajio|meesho|nykaa|croma|reliance digital|decathlon|ikea|urban ladder|pepperfry|zara|\bh ?& ?m\b|uniqlo|levis|mall\b|tata ?cliq)/i],
  ['entertainment', /(bookmyshow|pvr|inox|cinema|movie|steam|playstation|xbox|epic ?games|riot|concert|bookmyevent|bowling|amusement)/i],
  ['transfers', /(upi[\/-](p2a|p2p)|imps[\/-]p2a|self ?transfer|own acct|account transfer|moved to savings)/i],
];
