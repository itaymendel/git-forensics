import type { Forensics } from '../types.js';
import type { RiskWeights, FileRiskScore } from './types.js';
import {
  buildPercentileContext,
  getAllForensicsFiles,
  type PercentileContext,
} from './generate-insights.js';

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  revisions: 0.25,
  churn: 0.25,
  ownershipRisk: 0.2,
  age: 0.15,
  couplingScore: 0.15,
};

function mergeWeights(partial?: Partial<RiskWeights>): RiskWeights {
  if (!partial) return DEFAULT_RISK_WEIGHTS;
  return { ...DEFAULT_RISK_WEIGHTS, ...partial };
}

interface RiskLookups {
  revisions: Map<string, number>;
  churn: Map<string, number>;
  fractal: Map<string, number>;
  age: Map<string, number>;
  couplingScore: Map<string, number>;
}

function computeFileRisk(
  file: string,
  pctx: PercentileContext,
  lookups: RiskLookups,
  weights: RiskWeights
): FileRiskScore {
  const rev = lookups.revisions.get(file);
  const churn = lookups.churn.get(file);
  const fractal = lookups.fractal.get(file);
  const age = lookups.age.get(file);
  const coup = lookups.couplingScore.get(file);

  const revP = rev === undefined ? 0 : pctx.revisionsRanker(rev);
  const churnP = churn === undefined ? 0 : pctx.churnRanker(churn);
  const ownerP = fractal === undefined ? 0 : pctx.ownershipRiskRanker(fractal);
  const ageP = age === undefined ? 0 : pctx.ageRanker(age);
  const coupP = coup === undefined ? 0 : pctx.couplingScoreRanker(coup);

  const breakdown = {
    revisions: revP * weights.revisions,
    churn: churnP * weights.churn,
    ownershipRisk: ownerP * weights.ownershipRisk,
    age: ageP * weights.age,
    couplingScore: coupP * weights.couplingScore,
  };

  const riskScore =
    breakdown.revisions +
    breakdown.churn +
    breakdown.ownershipRisk +
    breakdown.age +
    breakdown.couplingScore;

  return { file, riskScore, breakdown };
}

/** Composite risk scores: weighted average of percentile ranks, sorted descending. */
export function computeRiskScores(
  forensics: Forensics,
  weights?: Partial<RiskWeights>
): FileRiskScore[] {
  const mergedWeights = mergeWeights(weights);
  const pctx = buildPercentileContext(forensics);
  const allFiles = getAllForensicsFiles(forensics);

  const lookups: RiskLookups = {
    revisions: new Map(forensics.hotspots.map((h) => [h.file, h.revisions])),
    churn: new Map(forensics.churn.map((c) => [c.file, c.churn])),
    fractal: new Map(forensics.ownership.map((o) => [o.file, o.fractalValue])),
    age: new Map(forensics.codeAge.map((a) => [a.file, a.ageMonths])),
    couplingScore: new Map(forensics.couplingRankings.map((s) => [s.file, s.couplingScore])),
  };

  const scores = [...allFiles].map((file) => computeFileRisk(file, pctx, lookups, mergedWeights));

  return scores.toSorted((a, b) => b.riskScore - a.riskScore);
}
