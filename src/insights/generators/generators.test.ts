import { describe, it, expect } from 'vitest';
import { generateHotspotInsight } from './hotspot.js';
import { generateCouplingInsight } from './coupling.js';
import { generateOwnershipInsight } from './ownership.js';
import { generateStaleCodeInsight } from './stale-code.js';
import { generateChurnInsight } from './churn.js';
import { generateCouplingScoreInsight } from './coupling-score.js';
import type {
  FileRevisions,
  CoupledPair,
  FileOwnership,
  FileAge,
  FileChurn,
  FileCoupling,
} from '../../types.js';
import type { InsightThresholds } from '../types.js';
import { DEFAULT_THRESHOLDS } from '../thresholds.js';
import { createPercentileRanker, createInvertedPercentileRanker } from '../percentile.js';

const thresholds = DEFAULT_THRESHOLDS;

// Distribution of 10 files: values 10..100 step 10
// P75 threshold means ~top 25% flagged, P90 means ~top 10%
const revisionsDist = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const revisionsRanker = createPercentileRanker(revisionsDist);

describe('generateHotspotInsight', () => {
  it('should return null when below P75 (warning threshold)', () => {
    // 70 → P65 (6 below, 1 equal out of 10) → (6+0.5)/10*100 = 65 → below 75
    const hotspot: FileRevisions = { file: 'app.ts', revisions: 70, exists: true };
    expect(generateHotspotInsight(hotspot, 4, thresholds, revisionsRanker)).toBeNull();
  });

  it('should return warning for P75-P89', () => {
    // 80 → P75 (7 below, 1 equal) → (7+0.5)/10*100 = 75 → exactly at warning
    const hotspot: FileRevisions = { file: 'app.ts', revisions: 80, exists: true };
    const result = generateHotspotInsight(hotspot, 3, thresholds, revisionsRanker);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.type).toBe('hotspot');
    expect(result!.data).toEqual({ type: 'hotspot', revisions: 80, rank: 3, percentile: 75 });
  });

  it('should return critical for P90+', () => {
    // 100 → P95 (9 below, 1 equal) → (9+0.5)/10*100 = 95 → above 90
    const hotspot: FileRevisions = { file: 'app.ts', revisions: 100, exists: true };
    const result = generateHotspotInsight(hotspot, 1, thresholds, revisionsRanker);

    expect(result!.severity).toBe('critical');
    expect(result!.data.type === 'hotspot' && result!.data.percentile).toBe(95);
  });

  it('should include percentile in fragments', () => {
    const hotspot: FileRevisions = { file: 'app.ts', revisions: 80, exists: true };
    const result = generateHotspotInsight(hotspot, 3, thresholds, revisionsRanker);

    expect(result!.fragments.title).toBe('Hotspot');
    expect(result!.fragments.finding).toContain('P75');
    expect(result!.fragments.finding).toContain('80 revisions');
  });
});

describe('generateCouplingInsight', () => {
  it('should return null when coupling below minPercent', () => {
    const pair: CoupledPair = {
      file1: 'a.ts',
      file2: 'b.ts',
      couplingPercent: 50,
      coChanges: 10,
      file1Exists: true,
      file2Exists: true,
    };
    expect(generateCouplingInsight('a.ts', pair, ['a.ts'], thresholds)).toBeNull();
  });

  it('should generate insight when coupled file is not in PR', () => {
    const pair: CoupledPair = {
      file1: 'a.ts',
      file2: 'b.ts',
      couplingPercent: 85,
      coChanges: 20,
      file1Exists: true,
      file2Exists: true,
    };
    const result = generateCouplingInsight('a.ts', pair, ['a.ts'], thresholds);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('coupling');
    expect(result!.severity).toBe('warning');
    expect(result!.data).toEqual({
      type: 'coupling',
      coupledWith: 'b.ts',
      percent: 85,
      bothInPR: false,
    });
  });

  it('should set bothInPR true when both files in PR', () => {
    const pair: CoupledPair = {
      file1: 'a.ts',
      file2: 'b.ts',
      couplingPercent: 85,
      coChanges: 20,
      file1Exists: true,
      file2Exists: true,
    };
    const result = generateCouplingInsight('a.ts', pair, ['a.ts', 'b.ts'], thresholds);

    expect(result!.data.type).toBe('coupling');
    if (result!.data.type === 'coupling') {
      expect(result!.data.bothInPR).toBe(true);
    }
  });

  it('should return null when warnIfMissingFromPR is false and both in PR', () => {
    const pair: CoupledPair = {
      file1: 'a.ts',
      file2: 'b.ts',
      couplingPercent: 85,
      coChanges: 20,
      file1Exists: true,
      file2Exists: true,
    };
    const customThresholds: InsightThresholds = {
      ...thresholds,
      coupling: { ...thresholds.coupling, warnIfMissingFromPR: false },
    };
    expect(generateCouplingInsight('a.ts', pair, ['a.ts', 'b.ts'], customThresholds)).toBeNull();
  });

  it('should include suggestion to review coupled file', () => {
    const pair: CoupledPair = {
      file1: 'user.ts',
      file2: 'permissions.ts',
      couplingPercent: 85,
      coChanges: 20,
      file1Exists: true,
      file2Exists: true,
    };
    const result = generateCouplingInsight('user.ts', pair, ['user.ts'], thresholds);

    expect(result!.fragments.suggestion).toContain('permissions.ts');
  });
});

describe('generateOwnershipInsight', () => {
  // Inverted: low fractal → high percentile
  const fractalDist = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const ownershipRanker = createInvertedPercentileRanker(fractalDist);

  it('should return null when percentile below warning', () => {
    // fractal=0.5 → inverted P: (5 above + 0.5*1)/10*100 = 55 → below 75
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 60,
      refactoringDev: 'alice',
      refactoringOwnership: 50,
      fractalValue: 0.5,
      authorCount: 5,
      exists: true,
    };
    expect(generateOwnershipInsight(ownership, thresholds, ownershipRanker)).toBeNull();
  });

  it('should return null when author count below minAuthors', () => {
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 50,
      refactoringDev: 'bob',
      refactoringOwnership: 50,
      fractalValue: 0.1,
      authorCount: 2,
      exists: true,
    };
    expect(generateOwnershipInsight(ownership, thresholds, ownershipRanker)).toBeNull();
  });

  it('should return warning for P75-P89', () => {
    // fractal=0.2 → inverted P: (8 above + 0.5*1)/10*100 = 85 → above 75, below 90
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 30,
      refactoringDev: 'bob',
      refactoringOwnership: 20,
      fractalValue: 0.2,
      authorCount: 5,
      exists: true,
    };
    const result = generateOwnershipInsight(ownership, thresholds, ownershipRanker);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.type).toBe('ownership-risk');
  });

  it('should return critical for P90+', () => {
    // fractal=0.1 → inverted P: (9 above + 0.5*1)/10*100 = 95 → above 90
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 20,
      refactoringDev: 'bob',
      refactoringOwnership: 15,
      fractalValue: 0.1,
      authorCount: 7,
      exists: true,
    };
    const result = generateOwnershipInsight(ownership, thresholds, ownershipRanker);

    expect(result!.severity).toBe('critical');
  });

  it('should suggest review from mainDev', () => {
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 30,
      refactoringDev: 'bob',
      refactoringOwnership: 20,
      fractalValue: 0.2,
      authorCount: 5,
      exists: true,
    };
    const result = generateOwnershipInsight(ownership, thresholds, ownershipRanker);

    expect(result!.fragments.suggestion).toContain('alice');
  });

  it('should include percentile in fragments', () => {
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 30,
      refactoringDev: 'bob',
      refactoringOwnership: 20,
      fractalValue: 0.2,
      authorCount: 5,
      exists: true,
    };
    const result = generateOwnershipInsight(ownership, thresholds, ownershipRanker);

    expect(result!.fragments.finding).toContain('P85');
  });
});

describe('generateStaleCodeInsight', () => {
  const ageDist = [1, 3, 6, 9, 12, 15, 18, 21, 24, 30];
  const ageRanker = createPercentileRanker(ageDist);

  it('should return null when percentile below warning', () => {
    // 12 → P45: (4 below + 0.5*1)/10*100 = 45 → below 75
    const age: FileAge = {
      file: 'app.ts',
      ageMonths: 12,
      lastModified: '2024-01-01',
      exists: true,
    };
    expect(generateStaleCodeInsight(age, thresholds, ageRanker)).toBeNull();
  });

  it('should return warning for P75-P89', () => {
    // 21 → P75: (7 below + 0.5*1)/10*100 = 75 → at warning
    const age: FileAge = {
      file: 'app.ts',
      ageMonths: 21,
      lastModified: '2023-03-15',
      exists: true,
    };
    const result = generateStaleCodeInsight(age, thresholds, ageRanker);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.type).toBe('stale-code');
  });

  it('should return critical for P90+', () => {
    // 30 → P95: (9 below + 0.5*1)/10*100 = 95 → above 90
    const age: FileAge = {
      file: 'app.ts',
      ageMonths: 30,
      lastModified: '2022-06-15',
      exists: true,
    };
    const result = generateStaleCodeInsight(age, thresholds, ageRanker);

    expect(result!.severity).toBe('critical');
  });

  it('should format lastModified date in fragments', () => {
    const age: FileAge = {
      file: 'app.ts',
      ageMonths: 24,
      lastModified: '2023-10-15',
      exists: true,
    };
    const result = generateStaleCodeInsight(age, thresholds, ageRanker);

    expect(result!.fragments.finding).toContain('24 months');
    expect(result!.fragments.finding).toContain('Oct 2023');
  });

  it('should include percentile in fragments', () => {
    const age: FileAge = {
      file: 'app.ts',
      ageMonths: 24,
      lastModified: '2023-10-15',
      exists: true,
    };
    const result = generateStaleCodeInsight(age, thresholds, ageRanker);

    expect(result!.fragments.finding).toContain('P85');
  });
});

describe('generateChurnInsight', () => {
  const churnDist = [100, 200, 400, 600, 800, 1200, 1500, 2000, 2500, 3500];
  const churnRanker = createPercentileRanker(churnDist);

  it('should return null when percentile below warning', () => {
    // 800 → P45: (4 below + 0.5*1)/10*100 = 45 → below 75
    const churn: FileChurn = {
      file: 'app.ts',
      added: 500,
      deleted: 300,
      churn: 800,
      revisions: 10,
      exists: true,
    };
    expect(generateChurnInsight(churn, thresholds, churnRanker)).toBeNull();
  });

  it('should return warning for P75-P89', () => {
    // 2000 → P75: (7 below + 0.5*1)/10*100 = 75 → at warning
    const churn: FileChurn = {
      file: 'app.ts',
      added: 1200,
      deleted: 800,
      churn: 2000,
      revisions: 15,
      exists: true,
    };
    const result = generateChurnInsight(churn, thresholds, churnRanker);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.type).toBe('high-churn');
  });

  it('should return critical for P90+', () => {
    // 3500 → P95: (9 below + 0.5*1)/10*100 = 95 → above 90
    const churn: FileChurn = {
      file: 'app.ts',
      added: 2500,
      deleted: 1000,
      churn: 3500,
      revisions: 20,
      exists: true,
    };
    const result = generateChurnInsight(churn, thresholds, churnRanker);

    expect(result!.severity).toBe('critical');
  });

  it('should format churn numbers with commas', () => {
    const churn: FileChurn = {
      file: 'app.ts',
      added: 1200,
      deleted: 800,
      churn: 2000,
      revisions: 15,
      exists: true,
    };
    const result = generateChurnInsight(churn, thresholds, churnRanker);

    expect(result!.fragments.finding).toContain('2,000');
    expect(result!.fragments.finding).toContain('+1,200');
    expect(result!.fragments.finding).toContain('-800');
  });

  it('should include percentile in data', () => {
    const churn: FileChurn = {
      file: 'app.ts',
      added: 1200,
      deleted: 800,
      churn: 2000,
      revisions: 15,
      exists: true,
    };
    const result = generateChurnInsight(churn, thresholds, churnRanker);

    expect(result!.data.type === 'high-churn' && result!.data.percentile).toBe(75);
  });
});

describe('generateCouplingScoreInsight', () => {
  const couplingDist = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const couplingRanker = createPercentileRanker(couplingDist);

  it('should return null when percentile below warning', () => {
    const coupling: FileCoupling = { file: 'app.ts', couplingScore: 5, exists: true };
    // 5 → P45: (4 below + 0.5*1)/10*100 = 45
    expect(generateCouplingScoreInsight(coupling, 5, thresholds, couplingRanker)).toBeNull();
  });

  it('should return warning for P75-P89', () => {
    const coupling: FileCoupling = { file: 'app.ts', couplingScore: 8, exists: true };
    // 8 → P75: (7 below + 0.5*1)/10*100 = 75
    const result = generateCouplingScoreInsight(coupling, 3, thresholds, couplingRanker);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.type).toBe('coupling-score');
  });

  it('should return critical for P90+', () => {
    const coupling: FileCoupling = { file: 'app.ts', couplingScore: 10, exists: true };
    // 10 → P95: (9 below + 0.5*1)/10*100 = 95
    const result = generateCouplingScoreInsight(coupling, 1, thresholds, couplingRanker);

    expect(result!.severity).toBe('critical');
  });

  it('should include percentile in fragments and data', () => {
    const coupling: FileCoupling = { file: 'app.ts', couplingScore: 8, exists: true };
    const result = generateCouplingScoreInsight(coupling, 3, thresholds, couplingRanker);

    expect(result!.fragments.finding).toContain('P75');
    expect(result!.data.type === 'coupling-score' && result!.data.percentile).toBe(75);
  });
});
