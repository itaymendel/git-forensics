import type { FileCoupling } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

export function generateCouplingScoreInsight(
  coupling: FileCoupling,
  rank: number,
  thresholds: InsightThresholds
): FileInsight | null {
  const { couplingScore } = coupling;
  const { warning, critical } = thresholds.couplingScore;

  if (couplingScore < warning) return null;

  const severity: InsightSeverity = couplingScore >= critical ? 'critical' : 'warning';

  return {
    file: coupling.file,
    type: 'coupling-score',
    severity,
    data: { type: 'coupling-score', couplingScore, rank },
    fragments: {
      title: 'Architectural Hub',
      finding: `Coupled to ${couplingScore} other files, ranked #${rank}`,
      risk: 'High fan-out amplifies blast radius of changes and increases regression risk',
      suggestion: 'Ensure coupled files are tested; consider decoupling if appropriate',
    },
  };
}
