import type { FileSoc } from '../../types.js';
import type { FileInsight, InsightThresholds, InsightSeverity } from '../types.js';

export function generateSocInsight(
  soc: FileSoc,
  rank: number,
  thresholds: InsightThresholds
): FileInsight | null {
  const { soc: socScore } = soc;
  const { warning, critical } = thresholds.soc;

  if (socScore < warning) return null;

  const severity: InsightSeverity = socScore >= critical ? 'critical' : 'warning';

  return {
    file: soc.file,
    type: 'soc',
    severity,
    data: { type: 'soc', soc: socScore, rank },
    fragments: {
      title: 'Architectural Hub',
      finding: `Coupled to ${socScore} other files, ranked #${rank}`,
      risk: 'Changes here have ripple effects across the codebase',
      suggestion: 'Ensure coupled files are tested; consider decoupling if appropriate',
    },
  };
}
