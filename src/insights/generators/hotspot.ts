import type { FileRevisions } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

export function generateHotspotInsight(
  hotspot: FileRevisions,
  rank: number,
  thresholds: InsightThresholds
): FileInsight | null {
  const { revisions } = hotspot;
  const { warning, critical } = thresholds.hotspot;

  if (revisions < warning) return null;

  const severity: InsightSeverity = revisions >= critical ? 'critical' : 'warning';

  return {
    file: hotspot.file,
    type: 'hotspot',
    severity,
    data: { type: 'hotspot', revisions, rank },
    fragments: {
      title: 'Hotspot',
      finding: `${revisions} revisions, ranked #${rank} in repository`,
      risk: 'Frequently changed files correlate with higher defect rates',
      suggestion: 'Consider breaking into smaller modules or adding test coverage',
    },
  };
}
