/**
 * Emergency checklist (§5.9): `always` steps first, then steps whose `when` matches
 * a Yes answer, and the `no_loss` steps only when every answer was No.
 */
import type { EmergencyQuestion, EmergencyStep } from './engine';

export type QuestionId = EmergencyQuestion['id'];
export type Answers = Partial<Record<QuestionId, boolean>>;

export function allNo(answers: Answers, questions: { id: QuestionId }[]): boolean {
  return questions.length > 0 && questions.every((q) => answers[q.id] === false);
}

export function buildChecklist(
  steps: EmergencyStep[],
  answers: Answers,
  questions: { id: QuestionId }[],
): EmergencyStep[] {
  const byPriority = (a: EmergencyStep, b: EmergencyStep) => a.priority - b.priority;
  const always = steps.filter((s) => s.when === 'always').sort(byPriority);
  const matching = steps
    .filter((s) => Array.isArray(s.when) && s.when.some((id) => answers[id] === true))
    .sort(byPriority);
  const noLoss = allNo(answers, questions)
    ? steps.filter((s) => s.when === 'no_loss').sort(byPriority)
    : [];
  return [...always, ...matching, ...noLoss];
}

/** href for a step action; internal actions are app routes. */
export function actionHref(action: NonNullable<EmergencyStep['action']>): string {
  if (action.kind === 'tel') return `tel:${action.value.replace(/[^\d+]/g, '')}`;
  return action.value;
}

/** Saved between /sos and /sos/report (survives a reload before printing). */
export interface ReportDraft {
  answers: Answers;
  scanIds: string[];
  createdAt: string;
}

const KEY = 'akshi-sos-draft';

export function saveDraft(d: ReportDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* private mode: the router state still carries it */
  }
}

export function loadDraft(): ReportDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ReportDraft>;
    if (typeof d !== 'object' || !d || !Array.isArray(d.scanIds)) return null;
    return {
      answers: typeof d.answers === 'object' && d.answers ? d.answers : {},
      scanIds: d.scanIds.filter((x): x is string => typeof x === 'string'),
      createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
