import type { SpendCategory, Txn } from '@akshi/contracts';

/** Keyword → category, checked in order against the description and counterparty (SPEC_C_DATA.md §6.2). */
const RULES: [SpendCategory, RegExp][] = [
  ['salary', /\bsalary\b|\bpayroll\b/],
  ['emi', /\bemi\b|\bloan\b/],
  ['investment', /\bsip\b|mutual fund|zerodha|groww|\bnps\b|\bppf\b/],
  ['cash', /\batm\b|cash wdl|cash withdrawal/],
  ['rent', /\brent\b/],
  ['food', /swiggy|zomato|canteen|restaurant|\bcafe\b|biryani|domino|tea stall|\bdhaba\b/],
  ['groceries', /bigbasket|blinkit|zepto|dmart|grocer|kirana|supermarket|\bdairy\b/],
  ['shopping', /amazon|flipkart|myntra|\bajio\b|meesho|stationery/],
  ['transport', /\buber\b|\bola\b|rapido|irctc|\bmetro\b|petrol|fuel|fastag|redbus/],
  ['bills', /electricity|\bjio\b|airtel|\bvi\b|broadband|\bgas\b|\bdth\b|recharge|water bill|\bbill\b/],
  ['education', /school|college|\bfees?\b|tuition|university/],
  ['health', /pharmacy|hospital|clinic|medical|diagnostic|\blab\b/],
  ['entertainment', /netflix|bookmyshow|hotstar|spotify|prime video|\bpvr\b|\binox\b/],
];

export function categorise(txn: Pick<Txn, 'description' | 'counterparty' | 'channel' | 'direction'>): SpendCategory {
  const text = `${txn.description} ${txn.counterparty ?? ''}`.toLowerCase();
  for (const [category, pattern] of RULES) {
    if (category === 'salary' && txn.direction !== 'credit') continue;
    if (pattern.test(text)) return category;
  }
  // a UPI payment that matches no merchant keyword is treated as person-to-person
  if (txn.channel === 'UPI' || txn.channel === 'IMPS') return 'transfers';
  return 'other';
}
