import type { FileAge } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function generateStaleCodeInsight(
  age: FileAge,
  thresholds: InsightThresholds
): FileInsight | null {
  const { warning, critical } = thresholds.staleCode;
  const { ageMonths, lastModified } = age;

  if (ageMonths < warning) return null;

  // Stale code uses info/warning (not critical) since it's less severe
  const severity: InsightSeverity = ageMonths >= critical ? 'warning' : 'info';

  return {
    file: age.file,
    type: 'stale-code',
    severity,
    data: {
      type: 'stale-code',
      ageMonths,
      lastModified,
    },
    fragments: {
      title: 'Stale Code',
      finding: `Unchanged for ${ageMonths} months (since ${formatDate(lastModified)})`,
      risk: 'Long-dormant code may have outdated patterns or hidden issues',
      suggestion: 'Extra review recommended; verify tests still cover this code',
    },
  };
}
