import type { Forensics, CoupledPair } from '../types.js';
import type { FileMetrics } from './types.js';
import { getOrCreate } from '../utils.js';

type CouplingEntry = { file: string; percent: number };

/** Build bidirectional coupling lookup from paired files. */
export function buildCouplingMap(pairs: readonly CoupledPair[]): Map<string, CouplingEntry[]> {
  const map = new Map<string, CouplingEntry[]>();
  for (const pair of pairs) {
    getOrCreate(map, pair.fileA, () => []).push({
      file: pair.fileB,
      percent: pair.couplingPercent,
    });
    getOrCreate(map, pair.fileB, () => []).push({
      file: pair.fileA,
      percent: pair.couplingPercent,
    });
  }
  return map;
}

/** Build a single file's metrics from lookup maps. */
function buildFileMetric(
  file: string,
  hotspotMap: Map<string, Forensics['hotspots'][number]>,
  ageMap: Map<string, Forensics['codeAge'][number]>,
  ownershipMap: Map<string, Forensics['ownership'][number]>,
  churnMap: Map<string, Forensics['churn'][number]>,
  couplingMap: Map<string, CouplingEntry[]>
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

  return [...ownershipMap.keys()].map((file) =>
    buildFileMetric(file, hotspotMap, ageMap, ownershipMap, churnMap, couplingMap)
  );
}
