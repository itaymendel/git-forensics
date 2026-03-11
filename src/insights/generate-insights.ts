import type { Forensics, CoupledPair } from '../types.js';
import type {
  FileInsight,
  GenerateInsightsOptions,
  InsightSeverity,
  InsightThresholds,
} from './types.js';
import { mergeThresholds } from './thresholds.js';
import { getOrCreate, pushIfPresent } from '../utils.js';
import { createPercentileRanker, createInvertedPercentileRanker } from './percentile.js';
import {
  generateHotspotInsight,
  generateCouplingInsight,
  generateOwnershipInsight,
  generateStaleCodeInsight,
  generateChurnInsight,
  generateCouplingScoreInsight,
} from './generators/index.js';

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

interface ForensicsLookups {
  hotspotMap: Map<string, { data: Forensics['hotspots'][number]; rank: number }>;
  ageMap: Map<string, Forensics['codeAge'][number]>;
  ownershipMap: Map<string, Forensics['ownership'][number]>;
  churnMap: Map<string, Forensics['churn'][number]>;
  couplingScoreMap: Map<string, { data: Forensics['couplingRankings'][number]; rank: number }>;
  couplingMap: Map<string, CoupledPair[]>;
}

export interface PercentileContext {
  revisionsRanker: (v: number) => number;
  churnRanker: (v: number) => number;
  ownershipRiskRanker: (v: number) => number;
  ageRanker: (v: number) => number;
  couplingScoreRanker: (v: number) => number;
}

function buildLookups(forensics: Forensics): ForensicsLookups {
  const couplingMap = new Map<string, CoupledPair[]>();
  for (const pair of forensics.coupledPairs) {
    getOrCreate(couplingMap, pair.file1, () => []).push(pair);
    getOrCreate(couplingMap, pair.file2, () => []).push(pair);
  }

  return {
    hotspotMap: new Map(
      forensics.hotspots.map((h, i) => [h.file, { data: h, rank: i + 1 }] as const)
    ),
    ageMap: new Map(forensics.codeAge.map((a) => [a.file, a] as const)),
    ownershipMap: new Map(forensics.ownership.map((o) => [o.file, o] as const)),
    churnMap: new Map(forensics.churn.map((c) => [c.file, c] as const)),
    couplingScoreMap: new Map(
      forensics.couplingRankings.map((s, i) => [s.file, { data: s, rank: i + 1 }] as const)
    ),
    couplingMap,
  };
}

export function buildPercentileContext(forensics: Forensics): PercentileContext {
  return {
    revisionsRanker: createPercentileRanker(forensics.hotspots.map((h) => h.revisions)),
    churnRanker: createPercentileRanker(forensics.churn.map((c) => c.churn)),
    ownershipRiskRanker: createInvertedPercentileRanker(
      forensics.ownership.map((o) => o.fractalValue)
    ),
    ageRanker: createPercentileRanker(forensics.codeAge.map((a) => a.ageMonths)),
    couplingScoreRanker: createPercentileRanker(
      forensics.couplingRankings.map((s) => s.couplingScore)
    ),
  };
}

export function getAllForensicsFiles(forensics: Forensics): Set<string> {
  const files = new Set<string>();
  for (const h of forensics.hotspots) files.add(h.file);
  for (const c of forensics.codeAge) files.add(c.file);
  for (const o of forensics.ownership) files.add(o.file);
  for (const c of forensics.churn) files.add(c.file);
  for (const s of forensics.couplingRankings) files.add(s.file);
  return files;
}

function generateInsightsForFile(
  file: string,
  lookups: ForensicsLookups,
  filesToProcess: readonly string[],
  thresholds: InsightThresholds,
  pctx: PercentileContext
): FileInsight[] {
  const insights: FileInsight[] = [];

  const hotspot = lookups.hotspotMap.get(file);
  if (hotspot)
    pushIfPresent(
      insights,
      generateHotspotInsight(hotspot.data, hotspot.rank, thresholds, pctx.revisionsRanker)
    );

  const pairs = lookups.couplingMap.get(file);
  if (pairs) {
    for (const pair of pairs) {
      pushIfPresent(insights, generateCouplingInsight(file, pair, filesToProcess, thresholds));
    }
  }

  const ownership = lookups.ownershipMap.get(file);
  if (ownership)
    pushIfPresent(
      insights,
      generateOwnershipInsight(ownership, thresholds, pctx.ownershipRiskRanker)
    );

  const age = lookups.ageMap.get(file);
  if (age) pushIfPresent(insights, generateStaleCodeInsight(age, thresholds, pctx.ageRanker));

  const churn = lookups.churnMap.get(file);
  if (churn) pushIfPresent(insights, generateChurnInsight(churn, thresholds, pctx.churnRanker));

  const couplingScore = lookups.couplingScoreMap.get(file);
  if (couplingScore)
    pushIfPresent(
      insights,
      generateCouplingScoreInsight(
        couplingScore.data,
        couplingScore.rank,
        thresholds,
        pctx.couplingScoreRanker
      )
    );

  return insights;
}

export function generateInsights(
  forensics: Forensics,
  options: GenerateInsightsOptions = {}
): FileInsight[] {
  const thresholds = mergeThresholds(options.thresholds);
  const minSeverity = options.minSeverity ?? 'info';
  const minSeverityOrder = SEVERITY_ORDER[minSeverity];
  const lookups = buildLookups(forensics);
  const pctx = buildPercentileContext(forensics);
  const filesToProcess = options.files ?? [...getAllForensicsFiles(forensics)];

  const insights = filesToProcess.flatMap((file) =>
    generateInsightsForFile(file, lookups, filesToProcess, thresholds, pctx)
  );

  return insights.filter((i) => SEVERITY_ORDER[i.severity] >= minSeverityOrder);
}
