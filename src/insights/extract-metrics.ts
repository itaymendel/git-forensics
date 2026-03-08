import type { Forensics, CoupledPair, FileContributors } from '../types.js';
import type { FileMetrics } from './types.js';
import { getOrCreate } from '../utils.js';

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

function buildFileMetric(
  file: string,
  hotspotMap: Map<string, Forensics['hotspots'][number]>,
  ageMap: Map<string, Forensics['codeAge'][number]>,
  ownershipMap: Map<string, Forensics['ownership'][number]>,
  churnMap: Map<string, Forensics['churn'][number]>,
  couplingMap: Map<string, CouplingEntry[]>,
  topContributorsMap: Map<string, FileContributors>
): FileMetrics {
  const hotspot = hotspotMap.get(file);
  const age = ageMap.get(file);
  const ownership = ownershipMap.get(file);
  const churn = churnMap.get(file);

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
    coupledWith: couplingMap.get(file) ?? [],
    topContributors: topContributorsMap.get(file)?.contributors ?? [],
  };
}

/**
 * Extract flat per-file metrics from forensics for server storage.
 *
 * @param forensics - Full forensics analysis result
 * @returns Array of per-file metrics suitable for storage
 */
export function extractFileMetrics(forensics: Forensics): FileMetrics[] {
  const hotspotMap = new Map(forensics.hotspots.map((h) => [h.file, h] as const));
  const ageMap = new Map(forensics.codeAge.map((a) => [a.file, a] as const));
  const ownershipMap = new Map(forensics.ownership.map((o) => [o.file, o] as const));
  const churnMap = new Map(forensics.churn.map((c) => [c.file, c] as const));
  const couplingMap = buildCouplingMap(forensics.coupledPairs);
  const topContributorsMap = new Map(forensics.topContributors.map((t) => [t.file, t] as const));

  const allFiles = new Set([
    ...hotspotMap.keys(),
    ...ageMap.keys(),
    ...ownershipMap.keys(),
    ...churnMap.keys(),
    ...topContributorsMap.keys(),
  ]);

  return [...allFiles].map((file) =>
    buildFileMetric(
      file,
      hotspotMap,
      ageMap,
      ownershipMap,
      churnMap,
      couplingMap,
      topContributorsMap
    )
  );
}
