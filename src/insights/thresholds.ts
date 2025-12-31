import type { InsightThresholds } from './types.js';

/**
 * Default thresholds based on "Code as a Crime Scene" research.
 */
export const DEFAULT_THRESHOLDS: InsightThresholds = {
  hotspot: {
    warning: 25,
    critical: 50,
  },
  coupling: {
    minPercent: 70,
    warnIfMissingFromPR: true,
  },
  ownershipRisk: {
    warning: 0.4,
    critical: 0.2,
    minAuthors: 3,
  },
  staleCode: {
    warning: 12,
    critical: 24,
  },
  churn: {
    warning: 1000,
    critical: 3000,
  },
  soc: {
    warning: 5,
    critical: 10,
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
    soc: { ...DEFAULT_THRESHOLDS.soc, ...partial.soc },
  };
}
