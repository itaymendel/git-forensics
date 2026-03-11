import type { FileOwnership } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

export function generateOwnershipInsight(
  ownership: FileOwnership,
  thresholds: InsightThresholds,
  percentileRank: (value: number) => number
): FileInsight | null {
  const { minAuthors } = thresholds.ownershipRisk;
  const { fractalValue, authorCount, mainDev } = ownership;

  // Skip if not enough authors to be considered fragmented
  if (authorCount < minAuthors) return null;

  // Inverted ranker: low fractalValue → high percentile (more fragmented = higher risk)
  const percentile = percentileRank(fractalValue);

  if (percentile < thresholds.ownershipRisk.warning) return null;

  const severity: InsightSeverity =
    percentile >= thresholds.ownershipRisk.critical ? 'critical' : 'warning';

  return {
    file: ownership.file,
    type: 'ownership-risk',
    severity,
    data: {
      type: 'ownership-risk',
      fractalValue,
      authorCount,
      mainDev,
      percentile,
    },
    fragments: {
      title: 'Fragmented Ownership',
      finding: `${authorCount} contributors, fragmentation score ${fractalValue.toFixed(2)} (P${Math.round(percentile)})`,
      risk: 'Diffuse ownership slows review cycles and increases merge conflicts',
      suggestion: `Request review from ${mainDev} (primary contributor)`,
    },
  };
}
