import { describe, it, expect } from 'vitest';
import { generateHotspotInsight } from './hotspot.js';
import { generateCouplingInsight } from './coupling.js';
import { generateOwnershipInsight } from './ownership.js';
import { generateStaleCodeInsight } from './stale-code.js';
import { generateChurnInsight } from './churn.js';
import type { FileRevisions, CoupledPair, FileOwnership, FileAge, FileChurn } from '../../types.js';
import type { InsightThresholds } from '../types.js';
import { DEFAULT_THRESHOLDS } from '../thresholds.js';

const thresholds = DEFAULT_THRESHOLDS;

describe('generateHotspotInsight', () => {
  it('should return null when below warning threshold', () => {
    const hotspot: FileRevisions = { file: 'app.ts', revisions: 10, exists: true };
    expect(generateHotspotInsight(hotspot, 1, thresholds)).toBeNull();
  });

  it('should return warning severity for revisions >= warning threshold', () => {
    const hotspot: FileRevisions = { file: 'app.ts', revisions: 30, exists: true };
    const result = generateHotspotInsight(hotspot, 1, thresholds);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.type).toBe('hotspot');
    expect(result!.data).toEqual({ type: 'hotspot', revisions: 30, rank: 1 });
  });

  it('should return critical severity for revisions >= critical threshold', () => {
    const hotspot: FileRevisions = { file: 'app.ts', revisions: 60, exists: true };
    const result = generateHotspotInsight(hotspot, 1, thresholds);

    expect(result!.severity).toBe('critical');
  });

  it('should include correct fragments', () => {
    const hotspot: FileRevisions = { file: 'app.ts', revisions: 47, exists: true };
    const result = generateHotspotInsight(hotspot, 3, thresholds);

    expect(result!.fragments.title).toBe('Hotspot');
    expect(result!.fragments.finding).toBe('47 revisions, ranked #3 in repository');
    expect(result!.fragments.risk).toContain('defect');
    expect(result!.fragments.suggestion).toContain('coverage');
  });
});

describe('generateCouplingInsight', () => {
  it('should return null when coupling below minPercent', () => {
    const pair: CoupledPair = {
      fileA: 'a.ts',
      fileB: 'b.ts',
      couplingPercent: 50,
      coChanges: 10,
      fileAExists: true,
      fileBExists: true,
    };
    expect(generateCouplingInsight('a.ts', pair, ['a.ts'], thresholds)).toBeNull();
  });

  it('should generate insight when coupled file is not in PR', () => {
    const pair: CoupledPair = {
      fileA: 'a.ts',
      fileB: 'b.ts',
      couplingPercent: 85,
      coChanges: 20,
      fileAExists: true,
      fileBExists: true,
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
      fileA: 'a.ts',
      fileB: 'b.ts',
      couplingPercent: 85,
      coChanges: 20,
      fileAExists: true,
      fileBExists: true,
    };
    const result = generateCouplingInsight('a.ts', pair, ['a.ts', 'b.ts'], thresholds);

    expect(result!.data.type).toBe('coupling');
    if (result!.data.type === 'coupling') {
      expect(result!.data.bothInPR).toBe(true);
    }
  });

  it('should return null when warnIfMissingFromPR is false and both in PR', () => {
    const pair: CoupledPair = {
      fileA: 'a.ts',
      fileB: 'b.ts',
      couplingPercent: 85,
      coChanges: 20,
      fileAExists: true,
      fileBExists: true,
    };
    const customThresholds: InsightThresholds = {
      ...thresholds,
      coupling: { ...thresholds.coupling, warnIfMissingFromPR: false },
    };
    expect(generateCouplingInsight('a.ts', pair, ['a.ts', 'b.ts'], customThresholds)).toBeNull();
  });

  it('should include suggestion to review coupled file', () => {
    const pair: CoupledPair = {
      fileA: 'user.ts',
      fileB: 'permissions.ts',
      couplingPercent: 85,
      coChanges: 20,
      fileAExists: true,
      fileBExists: true,
    };
    const result = generateCouplingInsight('user.ts', pair, ['user.ts'], thresholds);

    expect(result!.fragments.suggestion).toContain('permissions.ts');
  });
});

describe('generateOwnershipInsight', () => {
  it('should return null when fractal value above warning threshold', () => {
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 80,
      refactoringDev: 'alice',
      refactoringOwnership: 80,
      fractalValue: 0.6,
      authorCount: 2,
      exists: true,
    };
    expect(generateOwnershipInsight(ownership, thresholds)).toBeNull();
  });

  it('should return null when author count below minAuthors', () => {
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 50,
      refactoringDev: 'bob',
      refactoringOwnership: 50,
      fractalValue: 0.3,
      authorCount: 2,
      exists: true,
    };
    expect(generateOwnershipInsight(ownership, thresholds)).toBeNull();
  });

  it('should return warning for fractal <= warning threshold', () => {
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 40,
      refactoringDev: 'bob',
      refactoringOwnership: 30,
      fractalValue: 0.35,
      authorCount: 5,
      exists: true,
    };
    const result = generateOwnershipInsight(ownership, thresholds);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.type).toBe('ownership-risk');
  });

  it('should return critical for fractal <= critical threshold', () => {
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 20,
      refactoringDev: 'bob',
      refactoringOwnership: 15,
      fractalValue: 0.15,
      authorCount: 7,
      exists: true,
    };
    const result = generateOwnershipInsight(ownership, thresholds);

    expect(result!.severity).toBe('critical');
  });

  it('should suggest review from mainDev', () => {
    const ownership: FileOwnership = {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 30,
      refactoringDev: 'bob',
      refactoringOwnership: 20,
      fractalValue: 0.25,
      authorCount: 5,
      exists: true,
    };
    const result = generateOwnershipInsight(ownership, thresholds);

    expect(result!.fragments.suggestion).toContain('alice');
  });
});

describe('generateStaleCodeInsight', () => {
  it('should return null when age below warning threshold', () => {
    const age: FileAge = {
      file: 'app.ts',
      ageMonths: 6,
      lastModified: '2024-06-15',
      exists: true,
    };
    expect(generateStaleCodeInsight(age, thresholds)).toBeNull();
  });

  it('should return info for age >= warning threshold', () => {
    const age: FileAge = {
      file: 'app.ts',
      ageMonths: 14,
      lastModified: '2023-10-15',
      exists: true,
    };
    const result = generateStaleCodeInsight(age, thresholds);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('info');
    expect(result!.type).toBe('stale-code');
  });

  it('should return warning for age >= critical threshold', () => {
    const age: FileAge = {
      file: 'app.ts',
      ageMonths: 30,
      lastModified: '2022-06-15',
      exists: true,
    };
    const result = generateStaleCodeInsight(age, thresholds);

    expect(result!.severity).toBe('warning');
  });

  it('should format lastModified date in fragments', () => {
    const age: FileAge = {
      file: 'app.ts',
      ageMonths: 14,
      lastModified: '2023-10-15',
      exists: true,
    };
    const result = generateStaleCodeInsight(age, thresholds);

    expect(result!.fragments.finding).toContain('14 months');
    expect(result!.fragments.finding).toContain('Oct 2023');
  });
});

describe('generateChurnInsight', () => {
  it('should return null when churn below warning threshold', () => {
    const churn: FileChurn = {
      file: 'app.ts',
      added: 200,
      deleted: 100,
      churn: 300,
      revisions: 5,
      exists: true,
    };
    expect(generateChurnInsight(churn, thresholds)).toBeNull();
  });

  it('should return warning for churn >= warning threshold', () => {
    const churn: FileChurn = {
      file: 'app.ts',
      added: 800,
      deleted: 400,
      churn: 1200,
      revisions: 10,
      exists: true,
    };
    const result = generateChurnInsight(churn, thresholds);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.type).toBe('high-churn');
  });

  it('should return critical for churn >= critical threshold', () => {
    const churn: FileChurn = {
      file: 'app.ts',
      added: 2500,
      deleted: 1000,
      churn: 3500,
      revisions: 20,
      exists: true,
    };
    const result = generateChurnInsight(churn, thresholds);

    expect(result!.severity).toBe('critical');
  });

  it('should format churn numbers with commas', () => {
    const churn: FileChurn = {
      file: 'app.ts',
      added: 1800,
      deleted: 600,
      churn: 2400,
      revisions: 15,
      exists: true,
    };
    const result = generateChurnInsight(churn, thresholds);

    expect(result!.fragments.finding).toContain('2,400');
    expect(result!.fragments.finding).toContain('+1,800');
    expect(result!.fragments.finding).toContain('-600');
  });
});
