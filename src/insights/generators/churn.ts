import type { FileChurn } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function generateChurnInsight(
  churn: FileChurn,
  thresholds: InsightThresholds
): FileInsight | null {
  const { warning, critical } = thresholds.churn;
  const { churn: totalChurn, added, deleted } = churn;

  if (totalChurn < warning) return null;

  const severity: InsightSeverity = totalChurn >= critical ? 'critical' : 'warning';

  return {
    file: churn.file,
    type: 'high-churn',
    severity,
    data: {
      type: 'high-churn',
      churn: totalChurn,
      added,
      deleted,
    },
    fragments: {
      title: 'High Churn',
      finding: `${formatNumber(totalChurn)} lines changed (+${formatNumber(added)} / -${formatNumber(deleted)})`,
      risk: 'Frequent rewrites suggest unclear requirements or architectural friction',
      suggestion: 'Consider refactoring to stabilize this file',
    },
  };
}
