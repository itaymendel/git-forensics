import type { Forensics, CoupledPair, FileContributors } from '../types.js';
import type { FileMetrics, ExtractFileMetricsOptions } from './types.js';
import { getOrCreate } from '../utils.js';
import { buildPercentileContext, type PercentileContext } from './generate-insights.js';
import { DEFAULT_RISK_WEIGHTS } from './risk-score.js';

type CouplingEntry = { file: string; percent: number };

/** Build bidirectional coupling lookup from paired files. */
function buildCouplingMap(pairs: readonly CoupledPair[]): Map<string, CouplingEntry[]> {
  const map = new Map<string, CouplingEntry[]>();
  for (const pair of pairs) {
    getOrCreate(map, pair.file1, () => []).push({
      file: pair.file2,
      percent: pair.couplingPercent,
    });
    getOrCreate(map, pair.file2, () => []).push({
      file: pair.file1,
      percent: pair.couplingPercent,
    });
  }
  return map;
}

interface MetricsLookups {
  hotspotMap: Map<string, Forensics['hotspots'][number]>;
  ageMap: Map<string, Forensics['codeAge'][number]>;
  ownershipMap: Map<string, Forensics['ownership'][number]>;
  churnMap: Map<string, Forensics['churn'][number]>;
  couplingMap: Map<string, CouplingEntry[]>;
  topContributorsMap: Map<string, FileContributors>;
  couplingScoreMap: Map<string, number>;
}

function buildBaseMetrics(file: string, lookups: MetricsLookups): FileMetrics {
  const hotspot = lookups.hotspotMap.get(file);
  const age = lookups.ageMap.get(file);
  const ownership = lookups.ownershipMap.get(file);
  const churn = lookups.churnMap.get(file);

  return {
    file,
    revisions: hotspot?.revisions ?? 0,
    ageMonths: age?.ageMonths ?? 0,
    lastModified: age?.lastModified ?? '',
    churn: churn?.churn ?? 0,
    added: churn?.added ?? 0,
    deleted: churn?.deleted ?? 0,
    fractalValue: ownership?.fractalValue ?? 1,
    mainDev: ownership?.mainDev ?? 'unknown',
    authorCount: ownership?.authorCount ?? 0,
    coupledWith: lookups.couplingMap.get(file) ?? [],
    topContributors: lookups.topContributorsMap.get(file)?.contributors ?? [],
  };
}

function enrichWithPercentiles(
  base: FileMetrics,
  lookups: MetricsLookups,
  pctx: PercentileContext,
  riskWeights: typeof DEFAULT_RISK_WEIGHTS
): FileMetrics {
  const hotspot = lookups.hotspotMap.get(base.file);
  const age = lookups.ageMap.get(base.file);
  const ownership = lookups.ownershipMap.get(base.file);
  const churn = lookups.churnMap.get(base.file);
  const coupScore = lookups.couplingScoreMap.get(base.file);

  const revP = hotspot ? pctx.revisionsRanker(hotspot.revisions) : 0;
  const churnP = churn ? pctx.churnRanker(churn.churn) : 0;
  const ownerP = ownership ? pctx.ownershipRiskRanker(ownership.fractalValue) : 0;
  const ageP = age ? pctx.ageRanker(age.ageMonths) : 0;
  const coupP = coupScore === undefined ? 0 : pctx.couplingScoreRanker(coupScore);

  const percentiles = {
    revisions: revP,
    churn: churnP,
    ownershipRisk: ownerP,
    ageMonths: ageP,
    couplingScore: coupP,
  };

  const riskScore =
    revP * riskWeights.revisions +
    churnP * riskWeights.churn +
    ownerP * riskWeights.ownershipRisk +
    ageP * riskWeights.age +
    coupP * riskWeights.couplingScore;

  return { ...base, percentiles, riskScore };
}

/**
 * Extract flat per-file metrics from forensics for server storage.
 * Pass `options.includePercentiles` to enrich with percentile ranks and risk scores.
 */
export function extractFileMetrics(
  forensics: Forensics,
  options?: ExtractFileMetricsOptions
): FileMetrics[] {
  const lookups: MetricsLookups = {
    hotspotMap: new Map(forensics.hotspots.map((h) => [h.file, h] as const)),
    ageMap: new Map(forensics.codeAge.map((a) => [a.file, a] as const)),
    ownershipMap: new Map(forensics.ownership.map((o) => [o.file, o] as const)),
    churnMap: new Map(forensics.churn.map((c) => [c.file, c] as const)),
    couplingMap: buildCouplingMap(forensics.coupledPairs),
    topContributorsMap: new Map(forensics.topContributors.map((t) => [t.file, t] as const)),
    couplingScoreMap: new Map(
      forensics.couplingRankings.map((s) => [s.file, s.couplingScore] as const)
    ),
  };

  const allFiles = new Set([
    ...lookups.hotspotMap.keys(),
    ...lookups.ageMap.keys(),
    ...lookups.ownershipMap.keys(),
    ...lookups.churnMap.keys(),
    ...lookups.topContributorsMap.keys(),
  ]);

  if (!options?.includePercentiles) {
    return [...allFiles].map((file) => buildBaseMetrics(file, lookups));
  }

  const pctx = buildPercentileContext(forensics);
  const riskWeights = { ...DEFAULT_RISK_WEIGHTS, ...options.riskWeights };

  return [...allFiles].map((file) => {
    const base = buildBaseMetrics(file, lookups);
    return enrichWithPercentiles(base, lookups, pctx, riskWeights);
  });
}
