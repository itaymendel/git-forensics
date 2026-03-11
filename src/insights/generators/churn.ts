import type { FileChurn } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function generateChurnInsight(
  churn: FileChurn,
  thresholds: InsightThresholds,
  percentileRank: (value: number) => number
): FileInsight | null {
  const { churn: totalChurn, added, deleted } = churn;
  const percentile = percentileRank(totalChurn);

  if (percentile < thresholds.churn.warning) return null;

  const severity: InsightSeverity =
    percentile >= thresholds.churn.critical ? 'critical' : 'warning';

  return {
    file: churn.file,
    type: 'high-churn',
    severity,
    data: {
      type: 'high-churn',
      churn: totalChurn,
      added,
      deleted,
      percentile,
    },
    fragments: {
      title: 'High Churn',
      finding: `${formatNumber(totalChurn)} lines changed (P${Math.round(percentile)}) (+${formatNumber(added)} / -${formatNumber(deleted)})`,
      risk: 'Frequent rewrites suggest unclear requirements or architectural friction',
      suggestion: 'Consider refactoring to stabilize this file',
    },
  };
}
