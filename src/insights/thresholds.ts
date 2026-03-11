import type { InsightThresholds } from './types.js';

/**
 * Default thresholds using percentile-based classification.
 * P75 = warning, P90 = critical — self-calibrating across codebases.
 */
export const DEFAULT_THRESHOLDS: InsightThresholds = {
  hotspot: {
    warning: 75,
    critical: 90,
  },
  coupling: {
    minPercent: 70,
    warnIfMissingFromPR: true,
  },
  ownershipRisk: {
    warning: 75,
    critical: 90,
    minAuthors: 3,
  },
  staleCode: {
    warning: 75,
    critical: 90,
  },
  churn: {
    warning: 75,
    critical: 90,
  },
  couplingScore: {
    warning: 75,
    critical: 90,
  },
};

export function mergeThresholds(partial?: Partial<InsightThresholds>): InsightThresholds {
  if (!partial) return DEFAULT_THRESHOLDS;

  return {
    hotspot: { ...DEFAULT_THRESHOLDS.hotspot, ...partial.hotspot },
    coupling: { ...DEFAULT_THRESHOLDS.coupling, ...partial.coupling },
    ownershipRisk: { ...DEFAULT_THRESHOLDS.ownershipRisk, ...partial.ownershipRisk },
    staleCode: { ...DEFAULT_THRESHOLDS.staleCode, ...partial.staleCode },
    churn: { ...DEFAULT_THRESHOLDS.churn, ...partial.churn },
    couplingScore: { ...DEFAULT_THRESHOLDS.couplingScore, ...partial.couplingScore },
  };
}
