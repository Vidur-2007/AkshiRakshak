// STUB — owned by Laptop C; replaced on feat/data
import { describe, expect, it } from 'vitest';
import {
  DrillSchema,
  EmergencyContentSchema,
  EvalReportSchema,
  FaqItemSchema,
  IndicatorSchema,
  LandscapeSchema,
  PatternCardSchema,
  SampleMessageSchema,
} from '@akshi/contracts';
import {
  DRILLS,
  EMERGENCY,
  EVAL_REPORT,
  FAQ,
  INDICATORS,
  LANDSCAPE,
  PATTERN_CARDS,
  SAMPLE_MESSAGES,
} from '../src/index';

describe('content stub', () => {
  it('validates against the contracts', () => {
    DRILLS.forEach((d) => DrillSchema.parse(d));
    FAQ.forEach((f) => FaqItemSchema.parse(f));
    EmergencyContentSchema.parse(EMERGENCY);
    INDICATORS.forEach((i) => IndicatorSchema.parse(i));
    SAMPLE_MESSAGES.forEach((s) => SampleMessageSchema.parse(s));
    PATTERN_CARDS.forEach((p) => PatternCardSchema.parse(p));
    LandscapeSchema.parse(LANDSCAPE);
    EvalReportSchema.parse(EVAL_REPORT);
  });

  it('has the Phase 0 minimum counts', () => {
    expect(DRILLS).toHaveLength(2);
    expect(FAQ).toHaveLength(5);
    expect(EMERGENCY.questions).toHaveLength(6);
    expect(EMERGENCY.steps.length).toBeGreaterThanOrEqual(6);
    expect(INDICATORS).toHaveLength(10);
    expect(SAMPLE_MESSAGES).toHaveLength(6);
    expect(SAMPLE_MESSAGES.filter((s) => s.genuine)).toHaveLength(1);
    expect(PATTERN_CARDS).toHaveLength(2);
  });
});
