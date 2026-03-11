import type { FileRevisions } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

export function generateHotspotInsight(
  hotspot: FileRevisions,
  rank: number,
  thresholds: InsightThresholds,
  percentileRank: (value: number) => number
): FileInsight | null {
  const { revisions } = hotspot;
  const percentile = percentileRank(revisions);

  if (percentile < thresholds.hotspot.warning) return null;

  const severity: InsightSeverity =
    percentile >= thresholds.hotspot.critical ? 'critical' : 'warning';

  return {
    file: hotspot.file,
    type: 'hotspot',
    severity,
    data: { type: 'hotspot', revisions, rank, percentile },
    fragments: {
      title: 'Hotspot',
      finding: `${revisions} revisions (P${Math.round(percentile)}), ranked #${rank} in repository`,
      risk: 'Top-ranked churn file — prioritize for refactoring or test hardening',
      suggestion: 'Consider breaking into smaller modules or adding test coverage',
    },
  };
}
