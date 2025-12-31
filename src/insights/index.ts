export { generateInsights } from './generate-insights.js';
export { extractFileMetrics } from './extract-metrics.js';
export { DEFAULT_THRESHOLDS, mergeThresholds } from './thresholds.js';

// Re-export types
export type {
  InsightType,
  InsightSeverity,
  InsightData,
  InsightFragments,
  FileInsight,
  FileMetrics,
  InsightThresholds,
  GenerateInsightsOptions,
} from './types.js';
