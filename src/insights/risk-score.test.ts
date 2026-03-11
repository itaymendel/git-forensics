import { describe, it, expect } from 'vitest';
import { computeRiskScores, DEFAULT_RISK_WEIGHTS } from './risk-score.js';
import type { Forensics } from '../types.js';

const emptyForensics: Forensics = {
  analyzedCommits: 0,
  dateRange: { from: '', to: '' },
  metadata: {
    maxCommitsAnalyzed: 0,
    topN: 50,
    totalFilesAnalyzed: 0,
    totalAuthors: 0,
    analyzedAt: '',
  },
  hotspots: [],
  coupledPairs: [],
  couplingRankings: [],
  codeAge: [],
  ownership: [],
  churn: [],
  communication: [],
  topContributors: [],
  stats: { fileStats: {}, pairCoChanges: {} },
};

const mockForensics: Forensics = {
  analyzedCommits: 100,
  dateRange: { from: '2024-01-01', to: '2024-12-01' },
  metadata: {
    maxCommitsAnalyzed: 1000,
    topN: 50,
    totalFilesAnalyzed: 5,
    totalAuthors: 5,
    analyzedAt: '2024-12-01T00:00:00Z',
  },
  hotspots: [
    { file: 'risky.ts', revisions: 100, exists: true },
    { file: 'medium.ts', revisions: 50, exists: true },
    { file: 'safe.ts', revisions: 5, exists: true },
    { file: 'other1.ts', revisions: 20, exists: true },
    { file: 'other2.ts', revisions: 30, exists: true },
  ],
  coupledPairs: [],
  couplingRankings: [
    { file: 'risky.ts', couplingScore: 20, exists: true },
    { file: 'medium.ts', couplingScore: 10, exists: true },
    { file: 'safe.ts', couplingScore: 1, exists: true },
    { file: 'other1.ts', couplingScore: 5, exists: true },
    { file: 'other2.ts', couplingScore: 8, exists: true },
  ],
  codeAge: [
    { file: 'risky.ts', ageMonths: 36, lastModified: '2021-12-01', exists: true },
    { file: 'medium.ts', ageMonths: 12, lastModified: '2023-12-01', exists: true },
    { file: 'safe.ts', ageMonths: 1, lastModified: '2024-11-01', exists: true },
    { file: 'other1.ts', ageMonths: 6, lastModified: '2024-06-01', exists: true },
    { file: 'other2.ts', ageMonths: 9, lastModified: '2024-03-01', exists: true },
  ],
  ownership: [
    {
      file: 'risky.ts',
      mainDev: 'alice',
      ownershipPercent: 20,
      refactoringDev: 'bob',
      refactoringOwnership: 15,
      fractalValue: 0.1,
      authorCount: 8,
      exists: true,
    },
    {
      file: 'medium.ts',
      mainDev: 'alice',
      ownershipPercent: 50,
      refactoringDev: 'alice',
      refactoringOwnership: 40,
      fractalValue: 0.4,
      authorCount: 4,
      exists: true,
    },
    {
      file: 'safe.ts',
      mainDev: 'bob',
      ownershipPercent: 90,
      refactoringDev: 'bob',
      refactoringOwnership: 85,
      fractalValue: 0.9,
      authorCount: 1,
      exists: true,
    },
    {
      file: 'other1.ts',
      mainDev: 'carol',
      ownershipPercent: 70,
      refactoringDev: 'carol',
      refactoringOwnership: 60,
      fractalValue: 0.6,
      authorCount: 3,
      exists: true,
    },
    {
      file: 'other2.ts',
      mainDev: 'dave',
      ownershipPercent: 60,
      refactoringDev: 'dave',
      refactoringOwnership: 50,
      fractalValue: 0.5,
      authorCount: 3,
      exists: true,
    },
  ],
  churn: [
    { file: 'risky.ts', added: 5000, deleted: 3000, churn: 8000, revisions: 100, exists: true },
    { file: 'medium.ts', added: 1000, deleted: 500, churn: 1500, revisions: 50, exists: true },
    { file: 'safe.ts', added: 50, deleted: 10, churn: 60, revisions: 5, exists: true },
    { file: 'other1.ts', added: 300, deleted: 100, churn: 400, revisions: 20, exists: true },
    { file: 'other2.ts', added: 600, deleted: 200, churn: 800, revisions: 30, exists: true },
  ],
  communication: [],
  topContributors: [],
  stats: { fileStats: {}, pairCoChanges: {} },
};

describe('computeRiskScores', () => {
  it('should return empty array for empty forensics', () => {
    const scores = computeRiskScores(emptyForensics);
    expect(scores).toHaveLength(0);
  });

  it('should return scores for all files', () => {
    const scores = computeRiskScores(mockForensics);
    expect(scores).toHaveLength(5);
  });

  it('should sort by riskScore descending', () => {
    const scores = computeRiskScores(mockForensics);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!.riskScore).toBeGreaterThanOrEqual(scores[i]!.riskScore);
    }
  });

  it('should rank risky.ts highest', () => {
    const scores = computeRiskScores(mockForensics);
    expect(scores[0]!.file).toBe('risky.ts');
  });

  it('should rank safe.ts lowest', () => {
    const scores = computeRiskScores(mockForensics);
    expect(scores[scores.length - 1]!.file).toBe('safe.ts');
  });

  it('should have riskScore between 0 and 100', () => {
    const scores = computeRiskScores(mockForensics);
    for (const score of scores) {
      expect(score.riskScore).toBeGreaterThanOrEqual(0);
      expect(score.riskScore).toBeLessThanOrEqual(100);
    }
  });

  it('should include breakdown for each metric', () => {
    const scores = computeRiskScores(mockForensics);
    const risky = scores.find((s) => s.file === 'risky.ts')!;
    expect(risky.breakdown).toHaveProperty('revisions');
    expect(risky.breakdown).toHaveProperty('churn');
    expect(risky.breakdown).toHaveProperty('ownershipRisk');
    expect(risky.breakdown).toHaveProperty('age');
    expect(risky.breakdown).toHaveProperty('couplingScore');
  });

  it('should use 0 for missing metrics', () => {
    const partialForensics: Forensics = {
      ...emptyForensics,
      hotspots: [
        { file: 'only-hotspot.ts', revisions: 50, exists: true },
        { file: 'other.ts', revisions: 10, exists: true },
      ],
    };
    const scores = computeRiskScores(partialForensics);
    const score = scores.find((s) => s.file === 'only-hotspot.ts')!;
    // Only revisions contributes, all others are 0
    expect(score.breakdown.churn).toBe(0);
    expect(score.breakdown.ownershipRisk).toBe(0);
    expect(score.breakdown.age).toBe(0);
    expect(score.breakdown.couplingScore).toBe(0);
    expect(score.riskScore).toBeGreaterThan(0);
  });

  it('should accept custom weights', () => {
    // With all weight on revisions, the breakdown should reflect that
    const customScores = computeRiskScores(mockForensics, {
      revisions: 1.0,
      churn: 0,
      ownershipRisk: 0,
      age: 0,
      couplingScore: 0,
    });

    const risky = customScores.find((s) => s.file === 'risky.ts')!;
    // Only revisions should contribute
    expect(risky.breakdown.churn).toBe(0);
    expect(risky.breakdown.ownershipRisk).toBe(0);
    expect(risky.breakdown.age).toBe(0);
    expect(risky.breakdown.couplingScore).toBe(0);
    expect(risky.breakdown.revisions).toBeGreaterThan(0);
    // Risk score should equal just the revisions contribution
    expect(risky.riskScore).toBe(risky.breakdown.revisions);
  });

  it('should export DEFAULT_RISK_WEIGHTS', () => {
    expect(DEFAULT_RISK_WEIGHTS.revisions).toBe(0.25);
    expect(DEFAULT_RISK_WEIGHTS.churn).toBe(0.25);
    expect(DEFAULT_RISK_WEIGHTS.ownershipRisk).toBe(0.2);
    expect(DEFAULT_RISK_WEIGHTS.age).toBe(0.15);
    expect(DEFAULT_RISK_WEIGHTS.couplingScore).toBe(0.15);
  });
});
