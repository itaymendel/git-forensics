import type { FileOwnership } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

export function generateOwnershipInsight(
  ownership: FileOwnership,
  thresholds: InsightThresholds
): FileInsight | null {
  const { warning, critical, minAuthors } = thresholds.ownershipRisk;
  const { fractalValue, authorCount, mainDev } = ownership;

  // Skip if not enough authors to be considered fragmented
  if (authorCount < minAuthors) return null;

  // Skip if ownership is concentrated enough (higher fractal = more concentrated)
  if (fractalValue > warning) return null;

  const severity: InsightSeverity = fractalValue <= critical ? 'critical' : 'warning';

  return {
    file: ownership.file,
    type: 'ownership-risk',
    severity,
    data: {
      type: 'ownership-risk',
      fractalValue,
      authorCount,
      mainDev,
    },
    fragments: {
      title: 'Fragmented Ownership',
      finding: `${authorCount} contributors, fragmentation score ${fractalValue.toFixed(2)}`,
      risk: 'Diffuse ownership slows review cycles and increases merge conflicts',
      suggestion: `Request review from ${mainDev} (primary contributor)`,
    },
  };
}
