import type { FileAge } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function generateStaleCodeInsight(
  age: FileAge,
  thresholds: InsightThresholds,
  percentileRank: (value: number) => number
): FileInsight | null {
  const { ageMonths, lastModified } = age;
  const percentile = percentileRank(ageMonths);

  if (percentile < thresholds.staleCode.warning) return null;

  const severity: InsightSeverity =
    percentile >= thresholds.staleCode.critical ? 'critical' : 'warning';

  return {
    file: age.file,
    type: 'stale-code',
    severity,
    data: {
      type: 'stale-code',
      ageMonths,
      lastModified,
      percentile,
    },
    fragments: {
      title: 'Stale Code',
      finding: `Unchanged for ${ageMonths} months (P${Math.round(percentile)}) (since ${formatDate(lastModified)})`,
      risk: 'Untouched code drifts from current conventions and loses institutional knowledge',
      suggestion: 'Extra review recommended; verify tests still cover this code',
    },
  };
}
