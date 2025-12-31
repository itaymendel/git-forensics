import type { CoupledPair } from '../../types.js';
import type { FileInsight, InsightThresholds } from '../types.js';

export function generateCouplingInsight(
  file: string,
  pair: CoupledPair,
  changedFiles: readonly string[],
  thresholds: InsightThresholds
): FileInsight | null {
  const { minPercent, warnIfMissingFromPR } = thresholds.coupling;

  if (pair.couplingPercent < minPercent) return null;

  const coupledWith = pair.fileA === file ? pair.fileB : pair.fileA;
  const bothInPR = changedFiles.includes(coupledWith);

  // If both files are in the PR, only warn if configured to do so
  if (bothInPR && !warnIfMissingFromPR) return null;

  return {
    file,
    type: 'coupling',
    severity: 'warning',
    data: {
      type: 'coupling',
      coupledWith,
      percent: pair.couplingPercent,
      bothInPR,
    },
    fragments: {
      title: 'Temporal Coupling',
      finding: `Changes with ${coupledWith} in ${pair.couplingPercent}% of commits`,
      risk: 'Hidden dependency may cause bugs if only one file is modified',
      suggestion: bothInPR
        ? `${coupledWith} is also in this PR - verify changes are coordinated`
        : `Review ${coupledWith} for necessary changes`,
    },
  };
}
