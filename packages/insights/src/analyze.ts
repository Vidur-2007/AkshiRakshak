import type { Anomaly, Lang, SpendCategory, StatementAnalysis, Txn } from '@akshi/contracts';
import type { DebitInfo } from './features';
import { debitInfo, forestRows, hourOf, isRound, median, payeeKey, percentile, timeOf } from './features';
import { isolationForestScores } from './iforest';
import { CATEGORY_NAMES, EXPLANATIONS, FEATURE_NAMES, NARRATIVE, TITLES, VALUES, fill, money, pick } from './strings';

const MIN = 60_000;
const HOUR = 60 * MIN;
const FOREST_MIN_DEBITS = 20;
const FOREST_SCORE = 0.62;
const FOREST_TOP_SHARE = 0.05;
const SEVERITY_SCORE = { high: 0.9, medium: 0.6, low: 0.3 } as const;
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 } as const;

type Baseline = StatementAnalysis['baseline'];
type Feature = Anomaly['features'][number];
type Draft = Omit<Anomaly, 'id'>;

const nameOf = (t: Txn) => t.counterparty || t.upiId || t.description;
const clock = (t: Txn) => t.date.slice(11, 16);

export function computeBaseline(debits: DebitInfo[]): Baseline {
  const amounts = debits.map((d) => d.txn.amount);
  const hours = debits.filter((d) => d.txn.hasTime).map((d) => hourOf(d.txn));
  const perPayee = new Map<string, { name: string; count: number }>();
  for (const d of debits) {
    const entry = perPayee.get(d.key) ?? { name: nameOf(d.txn), count: 0 };
    entry.count++;
    perPayee.set(d.key, entry);
  }
  return {
    medianDebit: median(amounts),
    p90Debit: percentile(amounts, 0.9),
    usualHours: hours.length >= 5 ? [Math.floor(percentile(hours, 0.1)), Math.ceil(percentile(hours, 0.9))] : null,
    frequentPayees: [...perPayee.values()]
      .filter((p) => p.count >= 3)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map((p) => p.name),
  };
}

function medianDailyDebit(debits: DebitInfo[]): number {
  const perDay = new Map<string, number>();
  for (const d of debits) perDay.set(d.txn.date.slice(0, 10), (perDay.get(d.txn.date.slice(0, 10)) ?? 0) + d.txn.amount);
  return median([...perDay.values()]);
}

const outsideUsual = (d: DebitInfo, usual: Baseline['usualHours']) => {
  if (!usual || !d.txn.hasTime) return false;
  const h = hourOf(d.txn);
  return h < usual[0] || h > usual[1];
};

/** Rows for the "why unusual" table: this payment against the person's own baseline. */
function featureRows(d: DebitInfo, base: Baseline, lang: Lang, limit = 3): Feature[] {
  const t = (texts: Record<Lang, string>, params: Record<string, string | number> = {}) => fill(pick(texts, lang), params);
  const rows: { weight: number; row: Feature }[] = [];
  if (base.medianDebit > 0) {
    rows.push({
      weight: Math.abs(Math.log10(d.txn.amount / base.medianDebit)) * 2,
      row: { name: t(FEATURE_NAMES.amount), value: money(d.txn.amount), baseline: t(VALUES.usual, { value: money(base.medianDebit) }) },
    });
  }
  if (d.txn.hasTime && base.usualHours) {
    const h = hourOf(d.txn);
    const [lo, hi] = base.usualHours;
    const dist = h < lo ? lo - h : h > hi ? h - hi : 0;
    if (dist > 0) {
      rows.push({
        weight: 1.5 + dist / 6,
        row: { name: t(FEATURE_NAMES.time), value: clock(d.txn), baseline: t(VALUES.usualHours, { from: lo, to: hi }) },
      });
    }
  }
  if (d.firstEver) {
    rows.push({ weight: 1.2, row: { name: t(FEATURE_NAMES.payee), value: t(VALUES.firstPayment), baseline: t(VALUES.paidBefore) } });
  }
  if (d.prevHourCount >= 2) {
    rows.push({
      weight: 0.5 * d.prevHourCount,
      row: { name: t(FEATURE_NAMES.inHour), value: String(d.prevHourCount), baseline: t(VALUES.usuallyNone) },
    });
  }
  if (isRound(d.txn.amount)) {
    rows.push({ weight: 0.6, row: { name: t(FEATURE_NAMES.round), value: t(VALUES.yes), baseline: t(VALUES.rarely) } });
  }
  return rows.sort((a, b) => b.weight - a.weight).slice(0, limit).map((r) => r.row);
}

/** Rule anomalies in order of precedence (SPEC_C_DATA.md §6.4). */
function ruleAnomalies(txns: Txn[], debits: DebitInfo[], base: Baseline, lang: Lang): Draft[] {
  const t = (texts: Record<Lang, string>, params: Record<string, string | number> = {}) => fill(pick(texts, lang), params);
  const out: Draft[] = [];
  const med = base.medianDebit;
  const make = (type: Anomaly['type'], severity: Anomaly['severity'], ids: string[], explanation: string, features: Feature[]): Draft => ({
    txnIds: ids,
    type,
    severity,
    score: SEVERITY_SCORE[severity],
    title: t(TITLES[type]),
    explanation,
    features,
  });
  const timed = debits.filter((d) => d.txn.hasTime);

  // credit_then_return: money from a stranger, then a matching payment to someone new within 48 hours
  const seenParty = new Set<string>();
  const ordered = txns
    .map((txn, order) => ({ txn, order, time: timeOf(txn) }))
    .filter((x) => Number.isFinite(x.time))
    .sort((a, b) => a.time - b.time || a.order - b.order);
  const usedDebits = new Set<string>();
  for (const { txn, time } of ordered) {
    const key = payeeKey(txn);
    const stranger = !seenParty.has(key);
    seenParty.add(key);
    if (txn.direction !== 'credit' || !stranger || txn.amount < 500) continue;
    const back = debits.find(
      (d) => d.time >= time && d.time - time <= 48 * HOUR && d.isNew && !usedDebits.has(d.txn.id) &&
        Math.abs(d.txn.amount - txn.amount) <= 0.05 * txn.amount,
    );
    if (!back) continue;
    usedDebits.add(back.txn.id);
    const hours = Math.max(1, Math.ceil((back.time - time) / HOUR));
    out.push(
      make('credit_then_return', 'high', [txn.id, back.txn.id],
        t(EXPLANATIONS.credit_then_return, { amount: money(txn.amount), sender: nameOf(txn), out: money(back.txn.amount), payee: nameOf(back.txn), hours }),
        [
          { name: t(FEATURE_NAMES.credit), value: money(txn.amount), baseline: t(VALUES.unknownSender) },
          { name: t(FEATURE_NAMES.amount), value: money(back.txn.amount), baseline: t(VALUES.usual, { value: money(med) }) },
          { name: t(FEATURE_NAMES.gap), value: t(VALUES.hours, { n: hours }), baseline: t(VALUES.firstPayment) },
        ]),
    );
  }

  // burst_small_debits (a): three or more payments of ₹500 or less to one new payee within 30 minutes
  const byPayee = new Map<string, DebitInfo[]>();
  for (const d of timed) {
    if (d.txn.amount > 500) continue;
    const list = byPayee.get(d.key) ?? [];
    list.push(d);
    byPayee.set(d.key, list);
  }
  for (const list of byPayee.values()) {
    if (!list[0]!.isNew) continue;
    for (let i = 0; i < list.length; ) {
      let j = i;
      while (j + 1 < list.length && list[j + 1]!.time - list[i]!.time <= 30 * MIN) j++;
      const run = list.slice(i, j + 1);
      if (run.length >= 3) {
        const total = run.reduce((a, d) => a + d.txn.amount, 0);
        const minutes = Math.max(1, Math.round((run[run.length - 1]!.time - run[0]!.time) / MIN));
        out.push(
          make('burst_small_debits', 'high', run.map((d) => d.txn.id),
            t(EXPLANATIONS.burst_small_debits, { count: run.length, total: money(total), payee: nameOf(run[0]!.txn), minutes }),
            [
              { name: t(FEATURE_NAMES.count), value: `${run.length} × ${money(run[0]!.txn.amount)}`, baseline: t(VALUES.usuallyNone) },
              { name: t(FEATURE_NAMES.payee), value: t(VALUES.firstPayment), baseline: t(VALUES.paidBefore) },
              { name: t(FEATURE_NAMES.gap), value: t(VALUES.minutes, { n: minutes }), baseline: t(VALUES.perDay, { value: money(medianDailyDebit(debits)) }) },
            ]),
        );
        i = j + 1;
      } else i++;
    }
  }
  // burst_small_debits (b): five or more payments of any size within 10 minutes
  for (let i = 0; i < timed.length; ) {
    let j = i;
    while (j + 1 < timed.length && timed[j + 1]!.time - timed[i]!.time <= 10 * MIN) j++;
    if (j - i + 1 >= 5) {
      const run = timed.slice(i, j + 1);
      const total = run.reduce((a, d) => a + d.txn.amount, 0);
      const minutes = Math.max(1, Math.round((run[run.length - 1]!.time - run[0]!.time) / MIN));
      out.push(
        make('burst_small_debits', 'high', run.map((d) => d.txn.id),
          t(EXPLANATIONS.burst_any, { count: run.length, total: money(total), minutes }),
          [
            { name: t(FEATURE_NAMES.count), value: String(run.length), baseline: t(VALUES.usuallyNone) },
            { name: t(FEATURE_NAMES.amount), value: money(total), baseline: t(VALUES.perDay, { value: money(medianDailyDebit(debits)) }) },
          ]),
      );
      i = j + 1;
    } else i++;
  }

  // large_new_payee and round_amount_new_payee: one card per payment, the more serious rule wins
  for (const d of debits) {
    if (!d.isNew) continue;
    const a = d.txn.amount;
    const params = { amount: money(a), payee: nameOf(d.txn), median: money(med) };
    if (a >= Math.max(5 * med, 5000)) {
      out.push(make('large_new_payee', a >= 10 * med ? 'high' : 'medium', [d.txn.id], t(EXPLANATIONS.large_new_payee, params), featureRows(d, base, lang)));
    } else if (a >= 10000 && a % 1000 === 0) {
      out.push(make('round_amount_new_payee', 'medium', [d.txn.id], t(EXPLANATIONS.round_amount_new_payee, params), featureRows(d, base, lang)));
    }
  }

  // odd_hour: between midnight and 5 am, at least twice the usual amount, outside the person's usual hours
  for (const d of timed) {
    const h = hourOf(d.txn);
    if (h >= 5 || d.txn.amount < 2 * med || !outsideUsual(d, base.usualHours)) continue;
    out.push(
      make('odd_hour', d.isNew ? 'high' : 'medium', [d.txn.id],
        t(EXPLANATIONS.odd_hour, { amount: money(d.txn.amount), payee: nameOf(d.txn), time: clock(d.txn) }),
        featureRows(d, base, lang)),
    );
  }

  // duplicate: the same amount to the same payee within 10 minutes
  const lastByKey = new Map<string, DebitInfo>();
  for (const d of timed) {
    const k = `${d.key}|${d.txn.amount}`;
    const prev = lastByKey.get(k);
    if (prev && d.time - prev.time <= 10 * MIN) {
      const minutes = Math.max(1, Math.round((d.time - prev.time) / MIN));
      out.push(
        make('duplicate', 'low', [prev.txn.id, d.txn.id],
          t(EXPLANATIONS.duplicate, { amount: money(d.txn.amount), payee: nameOf(d.txn), minutes }),
          [
            { name: t(FEATURE_NAMES.count), value: `2 × ${money(d.txn.amount)}`, baseline: t(VALUES.once) },
            { name: t(FEATURE_NAMES.gap), value: t(VALUES.minutes, { n: minutes }), baseline: t(VALUES.usuallyNone) },
          ]),
      );
    }
    lastByKey.set(k, d);
  }

  // velocity: three or more payments in an hour that add up to four times a usual day's spending
  const daily = medianDailyDebit(debits);
  for (let i = 0; daily > 0 && i < timed.length; ) {
    let j = i;
    while (j + 1 < timed.length && timed[j + 1]!.time - timed[i]!.time <= HOUR) j++;
    const run = timed.slice(i, j + 1);
    const total = run.reduce((a, d) => a + d.txn.amount, 0);
    if (run.length >= 3 && total >= 4 * daily) {
      out.push(
        make('velocity', 'medium', run.map((d) => d.txn.id),
          t(EXPLANATIONS.velocity, { count: run.length, total: money(total), daily: money(daily) }),
          [
            { name: t(FEATURE_NAMES.count), value: String(run.length), baseline: t(VALUES.usuallyNone) },
            { name: t(FEATURE_NAMES.amount), value: money(total), baseline: t(VALUES.perDay, { value: money(daily) }) },
          ]),
      );
      i = j + 1;
    } else i++;
  }
  return out;
}

/** Keeps one card per payment: a later rule is dropped when every payment it names already has a card. */
function dropCovered(drafts: Draft[], debitIds: Set<string>): Draft[] {
  const covered = new Set<string>();
  const kept: Draft[] = [];
  for (const a of drafts) {
    const own = a.txnIds.filter((id) => debitIds.has(id));
    if (own.length > 0 && own.every((id) => covered.has(id))) continue;
    // fast spending needs three payments of its own, beyond those another card already explains
    if (a.type === 'velocity' && own.filter((id) => !covered.has(id)).length < 3) continue;
    own.forEach((id) => covered.add(id));
    kept.push(a);
  }
  return kept;
}

function summarise(txns: Txn[]): StatementAnalysis['summary'] {
  let totalIn = 0;
  let totalOut = 0;
  const byCat = new Map<SpendCategory, number>();
  const byMonth = new Map<string, { in: number; out: number }>();
  for (const t of txns) {
    const month = t.date.slice(0, 7);
    const m = byMonth.get(month) ?? { in: 0, out: 0 };
    if (t.direction === 'credit') {
      totalIn += t.amount;
      m.in += t.amount;
    } else {
      totalOut += t.amount;
      m.out += t.amount;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
    }
    byMonth.set(month, m);
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    totalIn: r(totalIn),
    totalOut: r(totalOut),
    byCategory: [...byCat].map(([category, amount]) => ({ category, amount: r(amount) })).sort((a, b) => b.amount - a.amount),
    byMonth: [...byMonth].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, in: r(v.in), out: r(v.out) })),
  };
}

function narrative(txns: Txn[], summary: StatementAnalysis['summary'], anomalies: Anomaly[], lang: Lang): string {
  const t = (texts: Record<Lang, string>, params: Record<string, string | number> = {}) => fill(pick(texts, lang), params);
  if (txns.length === 0) return t(NARRATIVE.empty);
  const top = summary.byCategory.slice(0, 2).map((c) => pick(CATEGORY_NAMES[c.category], lang));
  const spend = top.length === 2 ? t(NARRATIVE.spendTwo, { a: top[0]!, b: top[1]! }) : top.length === 1 ? t(NARRATIVE.spendOne, { a: top[0]! }) : t(NARRATIVE.noSpend);
  if (anomalies.length === 0) return `${spend} ${t(NARRATIVE.none, { count: txns.length })}`;
  const first = anomalies[0]!;
  const byId = new Map(txns.map((x) => [x.id, x]));
  const involved = first.txnIds.map((id) => byId.get(id)).filter((x): x is Txn => !!x && x.direction === 'debit');
  const amount = involved.reduce((a, x) => a + x.amount, 0);
  const detail = t(NARRATIVE.detail, { title: first.title, amount: money(amount), date: (involved[0] ?? byId.get(first.txnIds[0]!))?.date.slice(0, 10) ?? '' });
  return `${spend} ${anomalies.length === 1 ? t(NARRATIVE.one, { first: detail }) : t(NARRATIVE.many, { n: anomalies.length, first: detail })}`;
}

export function statementRisk(anomalies: Pick<Anomaly, 'severity'>[]): number {
  if (anomalies.length === 0) return 0;
  const n = (s: Anomaly['severity']) => anomalies.filter((a) => a.severity === s).length;
  return Math.min(100, 40 + 20 * n('high') + 10 * n('medium') + 3 * n('low'));
}

/** Baseline, anomalies (rules, then Isolation Forest), spending summary, risk score and a short narrative. */
export function analyzeStatement(txns: Txn[], lang: Lang): StatementAnalysis {
  const debits = debitInfo(txns);
  const baseline = computeBaseline(debits);
  const debitIds = new Set(debits.map((d) => d.txn.id));
  const drafts = dropCovered(ruleAnomalies(txns, debits, baseline, lang), debitIds);

  if (debits.length >= FOREST_MIN_DEBITS) {
    const withTime = debits.every((d) => d.txn.hasTime);
    const scores = isolationForestScores(forestRows(debits, withTime));
    const cutoff = [...scores].sort((a, b) => b - a)[Math.max(0, Math.ceil(debits.length * FOREST_TOP_SHARE) - 1)]!;
    const covered = new Set(drafts.flatMap((a) => a.txnIds));
    const paidTo = new Map<string, number[]>();
    for (const d of debits) paidTo.set(d.key, [...(paidTo.get(d.key) ?? []), d.txn.amount]);
    debits.forEach((d, i) => {
      const score = scores[i]!;
      if (score < FOREST_SCORE || score < cutoff || covered.has(d.txn.id)) return;
      // The forest also scores ordinary payments highly when they are the first row of a regular payee or sit at
      // an odd hour. Show an outlier only when it is unusual for that payee too: someone who is not paid
      // regularly, or more than double anything else paid to them.
      const amounts = paidTo.get(d.key)!;
      const others = amounts.slice();
      others.splice(others.indexOf(d.txn.amount), 1);
      if (d.established && d.txn.amount <= 2 * Math.max(...others)) return;
      drafts.push({
        txnIds: [d.txn.id],
        type: 'isolation_outlier',
        severity: score >= 0.7 ? 'medium' : 'low',
        score: Math.min(1, score),
        title: pick(TITLES.isolation_outlier, lang),
        explanation: fill(pick(EXPLANATIONS.isolation_outlier, lang), { amount: money(d.txn.amount), payee: nameOf(d.txn) }),
        features: featureRows(d, baseline, lang),
      });
    });
  }

  const order = new Map(txns.map((t, i) => [t.id, i]));
  const anomalies: Anomaly[] = drafts
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.score - a.score || order.get(a.txnIds[0]!)! - order.get(b.txnIds[0]!)!)
    .map((a, i) => ({ id: `anom-${String(i + 1).padStart(2, '0')}`, ...a }));
  const summary = summarise(txns);
  return { txns, anomalies, baseline, summary, riskScore: statementRisk(anomalies), narrative: narrative(txns, summary, anomalies, lang) };
}
