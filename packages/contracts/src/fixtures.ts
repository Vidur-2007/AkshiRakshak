/**
 * Typed fixtures (SPEC.md §6.7), parsed through their schemas.
 * Import from '@akshi/contracts/fixtures' — kept out of the main entry so the
 * web bundle does not pull them in unless a stub needs them.
 */
import {
  AnalysisResultSchema,
  DrillSchema,
  EntityGraphSchema,
  EvalReportSchema,
  StatementAnalysisSchema,
} from './schemas';
import scamKyc from '../fixtures/analysis-scam-kyc.json';
import suspiciousJob from '../fixtures/analysis-suspicious-job.json';
import nosignsOtp from '../fixtures/analysis-nosigns-otp.json';
import collect from '../fixtures/analysis-collect.json';
import qr from '../fixtures/analysis-qr.json';
import url from '../fixtures/analysis-url.json';
import image from '../fixtures/analysis-image.json';
import chat from '../fixtures/analysis-chat.json';
import email from '../fixtures/analysis-email.json';
import statementAnalysis from '../fixtures/statement-analysis.json';
import entityGraph from '../fixtures/entity-graph.json';
import evalReport from '../fixtures/eval-report.json';
import drill from '../fixtures/drill.json';

export const ANALYSIS_FIXTURES = {
  'analysis-scam-kyc': AnalysisResultSchema.parse(scamKyc),
  'analysis-suspicious-job': AnalysisResultSchema.parse(suspiciousJob),
  'analysis-nosigns-otp': AnalysisResultSchema.parse(nosignsOtp),
  'analysis-collect': AnalysisResultSchema.parse(collect),
  'analysis-qr': AnalysisResultSchema.parse(qr),
  'analysis-url': AnalysisResultSchema.parse(url),
  'analysis-image': AnalysisResultSchema.parse(image),
  'analysis-chat': AnalysisResultSchema.parse(chat),
  'analysis-email': AnalysisResultSchema.parse(email),
} as const;
export type AnalysisFixtureName = keyof typeof ANALYSIS_FIXTURES;

export const STATEMENT_ANALYSIS_FIXTURE = StatementAnalysisSchema.parse(statementAnalysis);
export const ENTITY_GRAPH_FIXTURE = EntityGraphSchema.parse(entityGraph);
export const EVAL_REPORT_FIXTURE = EvalReportSchema.parse(evalReport);
export const DRILL_FIXTURE = DrillSchema.parse(drill);
