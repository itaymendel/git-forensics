import { describe, it, expect } from 'vitest';
import { generateInsights } from './generate-insights.js';
import { extractFileMetrics } from './extract-metrics.js';
import type { Forensics } from '../types.js';

const mockForensics: Forensics = {
  analyzedCommits: 100,
  dateRange: { from: '2024-01-01', to: '2024-12-01' },
  metadata: {
    maxCommitsAnalyzed: 1000,
    topN: 50,
    totalFilesAnalyzed: 10,
    totalAuthors: 5,
    analyzedAt: '2024-12-01T00:00:00Z',
  },
  hotspots: [
    { file: 'hot.ts', revisions: 60, exists: true },
    { file: 'warm.ts', revisions: 30, exists: true },
    { file: 'cold.ts', revisions: 5, exists: true },
    { file: 'app.ts', revisions: 50, exists: true },
    { file: 'utils.ts', revisions: 20, exists: true },
  ],
  coupledPairs: [
    {
      file1: 'a.ts',
      file2: 'b.ts',
      couplingPercent: 85,
      coChanges: 20,
      file1Exists: true,
      file2Exists: true,
    },
    {
      file1: 'app.ts',
      file2: 'utils.ts',
      couplingPercent: 75,
      coChanges: 15,
      file1Exists: true,
      file2Exists: true,
    },
  ],
  couplingRankings: [],
  codeAge: [
    { file: 'old.ts', ageMonths: 18, lastModified: '2023-06-01', exists: true },
    { file: 'app.ts', ageMonths: 6, lastModified: '2024-06-01', exists: true },
    { file: 'utils.ts', ageMonths: 12, lastModified: '2024-01-01', exists: true },
  ],
  ownership: [
    {
      file: 'fragmented.ts',
      mainDev: 'alice',
      ownershipPercent: 25,
      refactoringDev: 'bob',
      refactoringOwnership: 20,
      fractalValue: 0.15,
      authorCount: 6,
      exists: true,
    },
    {
      file: 'app.ts',
      mainDev: 'alice',
      ownershipPercent: 60,
      refactoringDev: 'alice',
      refactoringOwnership: 50,
      fractalValue: 0.5,
      authorCount: 3,
      exists: true,
    },
    {
      file: 'utils.ts',
      mainDev: 'bob',
      ownershipPercent: 80,
      refactoringDev: 'bob',
      refactoringOwnership: 70,
      fractalValue: 0.7,
      authorCount: 2,
      exists: true,
    },
  ],
  churn: [
    { file: 'volatile.ts', added: 2000, deleted: 500, churn: 2500, revisions: 20, exists: true },
    { file: 'app.ts', added: 500, deleted: 200, churn: 700, revisions: 50, exists: true },
    { file: 'utils.ts', added: 100, deleted: 50, churn: 150, revisions: 20, exists: true },
  ],
  communication: [],
  stats: { fileStats: {}, pairCoChanges: {} },
};

describe('generateInsights', () => {
  it('should generate insights for all files when no filter provided', () => {
    const insights = generateInsights(mockForensics);

    // Should have insights from multiple files
    const files = new Set(insights.map((i) => i.file));
    expect(files.size).toBeGreaterThan(1);
  });

  it('should filter insights to specific files when files option provided', () => {
    const insights = generateInsights(mockForensics, { files: ['hot.ts', 'cold.ts'] });

    // hot.ts should have hotspot insight (60 revisions >= 50 critical)
    const hotInsights = insights.filter((i) => i.file === 'hot.ts');
    expect(hotInsights.length).toBeGreaterThan(0);

    // cold.ts should have no insights (only 5 revisions)
    const coldInsights = insights.filter((i) => i.file === 'cold.ts');
    expect(coldInsights).toHaveLength(0);
  });

  it('should filter by minSeverity', () => {
    const allInsights = generateInsights(mockForensics, { files: ['old.ts'] });
    const warningsOnly = generateInsights(mockForensics, {
      files: ['old.ts'],
      minSeverity: 'warning',
    });

    // old.ts has stale-code insight with 'info' severity (18 months < 24 critical)
    const infoInsights = allInsights.filter((i) => i.severity === 'info');
    expect(infoInsights.length).toBeGreaterThan(0);

    // Should be filtered out when minSeverity is warning
    const filteredInfoInsights = warningsOnly.filter((i) => i.severity === 'info');
    expect(filteredInfoInsights).toHaveLength(0);
  });

  it('should generate coupling insights when coupled file not in PR', () => {
    const insights = generateInsights(mockForensics, { files: ['a.ts'] });

    const couplingInsight = insights.find((i) => i.type === 'coupling');
    expect(couplingInsight).toBeDefined();
    expect(couplingInsight!.data.type).toBe('coupling');
    if (couplingInsight!.data.type === 'coupling') {
      expect(couplingInsight!.data.coupledWith).toBe('b.ts');
      expect(couplingInsight!.data.bothInPR).toBe(false);
    }
  });

  it('should respect custom thresholds', () => {
    // warm.ts has 30 revisions - above default warning (25)
    const insights = generateInsights(mockForensics, {
      files: ['warm.ts'],
      thresholds: { hotspot: { warning: 20, critical: 40 } },
    });

    const hotspotInsight = insights.find((i) => i.type === 'hotspot');
    expect(hotspotInsight).toBeDefined();
  });

  it('should return empty array for files with no insights', () => {
    const insights = generateInsights(mockForensics, { files: ['nonexistent.ts'] });
    expect(insights).toHaveLength(0);
  });
});

describe('extractFileMetrics', () => {
  it('should extract metrics for all files', () => {
    const metrics = extractFileMetrics(mockForensics);
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('should include all required fields', () => {
    const metrics = extractFileMetrics(mockForensics);
    const appMetrics = metrics.find((m) => m.file === 'app.ts');

    expect(appMetrics).toBeDefined();
    expect(appMetrics!.revisions).toBe(50);
    expect(appMetrics!.ageMonths).toBe(6);
    expect(appMetrics!.lastModified).toBe('2024-06-01');
    expect(appMetrics!.churn).toBe(700);
    expect(appMetrics!.added).toBe(500);
    expect(appMetrics!.deleted).toBe(200);
    expect(appMetrics!.fractalValue).toBe(0.5);
    expect(appMetrics!.mainDev).toBe('alice');
    expect(appMetrics!.authorCount).toBe(3);
  });

  it('should include coupling information', () => {
    const metrics = extractFileMetrics(mockForensics);
    const appMetrics = metrics.find((m) => m.file === 'app.ts');

    expect(appMetrics!.coupledWith).toHaveLength(1);
    expect(appMetrics!.coupledWith[0]).toEqual({ file: 'utils.ts', percent: 75 });
  });

  it('should handle files with no coupling', () => {
    const forensicsNoCoupling: Forensics = {
      ...mockForensics,
      coupledPairs: [],
    };
    const metrics = extractFileMetrics(forensicsNoCoupling);

    expect(metrics[0]!.coupledWith).toHaveLength(0);
  });
});
