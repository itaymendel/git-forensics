export { generateInsights } from './generate-insights.js';
export { extractFileMetrics } from './extract-metrics.js';
export { DEFAULT_THRESHOLDS, mergeThresholds } from './thresholds.js';
export { computeRiskScores, DEFAULT_RISK_WEIGHTS } from './risk-score.js';
export {
  percentileRank,
  createPercentileRanker,
  createInvertedPercentileRanker,
} from './percentile.js';

// Re-export types
export type {
  InsightType,
  InsightSeverity,
  InsightData,
  InsightFragments,
  FileInsight,
  FileMetrics,
  InsightThresholds,
  PercentileThresholds,
  GenerateInsightsOptions,
  RiskWeights,
  FileRiskScore,
  ExtractFileMetricsOptions,
} from './types.js';
