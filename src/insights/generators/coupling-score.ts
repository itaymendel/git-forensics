import type { FileCoupling } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

export function generateCouplingScoreInsight(
  coupling: FileCoupling,
  rank: number,
  thresholds: InsightThresholds,
  percentileRank: (value: number) => number
): FileInsight | null {
  const { couplingScore } = coupling;
  const percentile = percentileRank(couplingScore);

  if (percentile < thresholds.couplingScore.warning) return null;

  const severity: InsightSeverity =
    percentile >= thresholds.couplingScore.critical ? 'critical' : 'warning';

  return {
    file: coupling.file,
    type: 'coupling-score',
    severity,
    data: { type: 'coupling-score', couplingScore, rank, percentile },
    fragments: {
      title: 'Architectural Hub',
      finding: `Coupled to ${couplingScore} other files (P${Math.round(percentile)}), ranked #${rank}`,
      risk: 'High fan-out amplifies blast radius of changes and increases regression risk',
      suggestion: 'Ensure coupled files are tested; consider decoupling if appropriate',
    },
  };
}
