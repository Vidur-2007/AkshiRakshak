import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ChannelSchema, LangSchema, ScamCategorySchema } from '@akshi/contracts';
import type { StatementLabel } from './metrics';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MESSAGES_DIR = join(REPO, 'data', 'messages');
export const STATEMENTS_DIR = join(REPO, 'data', 'statements');

/** A row of data/messages/*.jsonl (SPEC_C_DATA.md §3.1). */
export const RowSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  lang: LangSchema,
  script: z.enum(['latn', 'deva', 'telu', 'beng', 'mixed']),
  channel: ChannelSchema,
  label: z.enum(['scam', 'legit']),
  category: ScamCategorySchema.nullable(),
  family: z.string(),
  split: z.enum(['train', 'val', 'test', 'handwritten']),
  source: z.enum(['synthetic', 'handwritten']),
  hard_negative: z.boolean(),
  notes: z.string(),
});
export type Row = z.infer<typeof RowSchema>;

/** Every row of every .jsonl file in the folder, validated. Throws with the file and line on a bad row. */
export function loadRows(dir: string = MESSAGES_DIR): Row[] {
  const rows: Row[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
    readFileSync(join(dir, file), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (line.trim() === '') return;
        const parsed = RowSchema.safeParse(JSON.parse(line));
        if (!parsed.success) throw new Error(file + ':' + (i + 1) + ': ' + parsed.error.issues[0]?.message);
        rows.push(parsed.data);
      });
  }
  return rows;
}

const LabelsSchema = z.array(z.object({ txnIds: z.array(z.string()), type: z.string() }));

/** Labelled scenarios of a sample statement, or null when it has no labels file. */
export function loadStatementLabels(id: string, dir: string = STATEMENTS_DIR): StatementLabel[] | null {
  const file = join(dir, id + '.labels.json');
  if (!existsSync(file)) return null;
  return LabelsSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}
