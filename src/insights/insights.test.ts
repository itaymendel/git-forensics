import { describe, it, expect } from 'vitest';
import { generateInsights } from './generate-insights.js';
import { extractFileMetrics } from './extract-metrics.js';
import type { Forensics } from '../types.js';

// 10 files for meaningful percentile spread
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
    { file: 'hot.ts', revisions: 100, exists: true },
    { file: 'warm.ts', revisions: 80, exists: true },
    { file: 'app.ts', revisions: 60, exists: true },
    { file: 'utils.ts', revisions: 50, exists: true },
    { file: 'cold.ts', revisions: 5, exists: true },
    { file: 'f1.ts', revisions: 10, exists: true },
    { file: 'f2.ts', revisions: 20, exists: true },
    { file: 'f3.ts', revisions: 30, exists: true },
    { file: 'f4.ts', revisions: 40, exists: true },
    { file: 'f5.ts', revisions: 70, exists: true },
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
    { file: 'old.ts', ageMonths: 36, lastModified: '2021-12-01', exists: true },
    { file: 'app.ts', ageMonths: 6, lastModified: '2024-06-01', exists: true },
    { file: 'utils.ts', ageMonths: 12, lastModified: '2024-01-01', exists: true },
    { file: 'f1.ts', ageMonths: 3, lastModified: '2024-09-01', exists: true },
    { file: 'f2.ts', ageMonths: 9, lastModified: '2024-03-01', exists: true },
    { file: 'f3.ts', ageMonths: 15, lastModified: '2023-09-01', exists: true },
    { file: 'f4.ts', ageMonths: 18, lastModified: '2023-06-01', exists: true },
    { file: 'f5.ts', ageMonths: 21, lastModified: '2023-03-01', exists: true },
    { file: 'hot.ts', ageMonths: 1, lastModified: '2024-11-01', exists: true },
    { file: 'warm.ts', ageMonths: 24, lastModified: '2022-12-01', exists: true },
  ],
  ownership: [
    {
      file: 'fragmented.ts',
      mainDev: 'alice',
      ownershipPercent: 25,
      refactoringDev: 'bob',
      refactoringOwnership: 20,
      fractalValue: 0.1,
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
      authorCount: 4,
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
    {
      file: 'f1.ts',
      mainDev: 'carol',
      ownershipPercent: 90,
      refactoringDev: 'carol',
      refactoringOwnership: 85,
      fractalValue: 0.9,
      authorCount: 1,
      exists: true,
    },
    {
      file: 'f2.ts',
      mainDev: 'dave',
      ownershipPercent: 70,
      refactoringDev: 'dave',
      refactoringOwnership: 60,
      fractalValue: 0.6,
      authorCount: 3,
      exists: true,
    },
    {
      file: 'f3.ts',
      mainDev: 'eve',
      ownershipPercent: 50,
      refactoringDev: 'eve',
      refactoringOwnership: 40,
      fractalValue: 0.4,
      authorCount: 4,
      exists: true,
    },
    {
      file: 'f4.ts',
      mainDev: 'frank',
      ownershipPercent: 40,
      refactoringDev: 'frank',
      refactoringOwnership: 30,
      fractalValue: 0.3,
      authorCount: 5,
      exists: true,
    },
    {
      file: 'f5.ts',
      mainDev: 'grace',
      ownershipPercent: 35,
      refactoringDev: 'grace',
      refactoringOwnership: 25,
      fractalValue: 0.2,
      authorCount: 6,
      exists: true,
    },
    {
      file: 'hot.ts',
      mainDev: 'alice',
      ownershipPercent: 85,
      refactoringDev: 'alice',
      refactoringOwnership: 80,
      fractalValue: 0.8,
      authorCount: 2,
      exists: true,
    },
    {
      file: 'warm.ts',
      mainDev: 'bob',
      ownershipPercent: 95,
      refactoringDev: 'bob',
      refactoringOwnership: 90,
      fractalValue: 1.0,
      authorCount: 1,
      exists: true,
    },
  ],
  churn: [
    { file: 'volatile.ts', added: 5000, deleted: 3000, churn: 8000, revisions: 30, exists: true },
    { file: 'app.ts', added: 500, deleted: 200, churn: 700, revisions: 60, exists: true },
    { file: 'utils.ts', added: 100, deleted: 50, churn: 150, revisions: 50, exists: true },
    { file: 'f1.ts', added: 200, deleted: 100, churn: 300, revisions: 10, exists: true },
    { file: 'f2.ts', added: 400, deleted: 200, churn: 600, revisions: 20, exists: true },
    { file: 'f3.ts', added: 800, deleted: 400, churn: 1200, revisions: 30, exists: true },
    { file: 'f4.ts', added: 1500, deleted: 700, churn: 2200, revisions: 40, exists: true },
    { file: 'f5.ts', added: 2000, deleted: 1000, churn: 3000, revisions: 70, exists: true },
    { file: 'hot.ts', added: 3000, deleted: 1500, churn: 4500, revisions: 100, exists: true },
    { file: 'warm.ts', added: 2500, deleted: 1200, churn: 3700, revisions: 80, exists: true },
  ],
  communication: [],
  topContributors: [
    {
      file: 'app.ts',
      contributors: [
        { author: 'alice', percent: 60, revisions: 30 },
        { author: 'bob', percent: 40, revisions: 20 },
      ],
      authorCount: 2,
      exists: true,
    },
  ],
  stats: { fileStats: {}, pairCoChanges: {} },
};

describe('generateInsights', () => {
  it('should generate insights for all files when no filter provided', () => {
    const insights = generateInsights(mockForensics);

    // Should have insights from multiple files
    const files = new Set(insights.map((i) => i.file));
    expect(files.size).toBeGreaterThan(1);
  });

  it('should flag top percentile files as hotspots', () => {
    // hot.ts has 100 revisions (P95 in a 10-file dist) → should be critical
    const insights = generateInsights(mockForensics, { files: ['hot.ts'] });
    const hotspotInsight = insights.find((i) => i.type === 'hotspot');
    expect(hotspotInsight).toBeDefined();
    expect(hotspotInsight!.severity).toBe('critical');
  });

  it('should not flag low percentile files', () => {
    // cold.ts has 5 revisions (P5 in a 10-file dist) → should not be flagged
    const insights = generateInsights(mockForensics, { files: ['cold.ts'] });
    const hotspotInsight = insights.find((i) => i.type === 'hotspot');
    expect(hotspotInsight).toBeUndefined();
  });

  it('should filter insights to specific files when files option provided', () => {
    const insights = generateInsights(mockForensics, { files: ['hot.ts', 'cold.ts'] });

    const hotInsights = insights.filter((i) => i.file === 'hot.ts');
    expect(hotInsights.length).toBeGreaterThan(0);

    const coldInsights = insights.filter((i) => i.file === 'cold.ts');
    expect(coldInsights).toHaveLength(0);
  });

  it('should filter by minSeverity', () => {
    const allInsights = generateInsights(mockForensics);
    const criticalOnly = generateInsights(mockForensics, { minSeverity: 'critical' });

    expect(criticalOnly.length).toBeLessThanOrEqual(allInsights.length);
    for (const insight of criticalOnly) {
      expect(insight.severity).toBe('critical');
    }
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

  it('should respect custom percentile thresholds', () => {
    // With low thresholds, more files should be flagged
    const lowThresholdInsights = generateInsights(mockForensics, {
      thresholds: { hotspot: { warning: 30, critical: 60 } },
    });
    const defaultInsights = generateInsights(mockForensics);

    const lowHotspots = lowThresholdInsights.filter((i) => i.type === 'hotspot');
    const defaultHotspots = defaultInsights.filter((i) => i.type === 'hotspot');
    expect(lowHotspots.length).toBeGreaterThanOrEqual(defaultHotspots.length);
  });

  it('should return empty array for files with no insights', () => {
    const insights = generateInsights(mockForensics, { files: ['nonexistent.ts'] });
    expect(insights).toHaveLength(0);
  });

  it('should produce insights that are relative to the dataset', () => {
    // Same file, different contexts: in a small dataset vs large
    const smallForensics: Forensics = {
      ...mockForensics,
      hotspots: [
        { file: 'target.ts', revisions: 20, exists: true },
        { file: 'other.ts', revisions: 10, exists: true },
      ],
    };
    // In small dataset, 20 revisions is P75 → should be flagged
    const insights = generateInsights(smallForensics, { files: ['target.ts'] });
    const hotspot = insights.find((i) => i.type === 'hotspot');
    expect(hotspot).toBeDefined();
  });

  it('should include percentile in insight data', () => {
    const insights = generateInsights(mockForensics, { files: ['hot.ts'] });
    const hotspot = insights.find((i) => i.type === 'hotspot');
    expect(hotspot).toBeDefined();
    if (hotspot!.data.type === 'hotspot') {
      expect(hotspot!.data.percentile).toBeGreaterThan(0);
    }
  });

  it('stale-code uses warning/critical severity levels', () => {
    // old.ts has ageMonths=36 → P95 → should be critical
    const insights = generateInsights(mockForensics, { files: ['old.ts'] });
    const stale = insights.find((i) => i.type === 'stale-code');
    expect(stale).toBeDefined();
    expect(stale!.severity).toBe('critical');
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
    expect(appMetrics!.revisions).toBe(60);
    expect(appMetrics!.ageMonths).toBe(6);
    expect(appMetrics!.lastModified).toBe('2024-06-01');
    expect(appMetrics!.churn).toBe(700);
    expect(appMetrics!.added).toBe(500);
    expect(appMetrics!.deleted).toBe(200);
    expect(appMetrics!.fractalValue).toBe(0.5);
    expect(appMetrics!.mainDev).toBe('alice');
    expect(appMetrics!.authorCount).toBe(4);
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

  it('should use fallback values when file appears in only some maps', () => {
    // "volatile.ts" is in churn but NOT in hotspots, codeAge, or ownership
    const metrics = extractFileMetrics(mockForensics);
    const volatileMetrics = metrics.find((m) => m.file === 'volatile.ts');

    expect(volatileMetrics).toBeDefined();
    expect(volatileMetrics!.revisions).toBe(0);
    expect(volatileMetrics!.churn).toBe(8000);
    expect(volatileMetrics!.fractalValue).toBe(1);
    expect(volatileMetrics!.mainDev).toBe('unknown');
  });

  it('should include topContributors from forensics', () => {
    const metrics = extractFileMetrics(mockForensics);
    const appMetrics = metrics.find((m) => m.file === 'app.ts');

    expect(appMetrics!.topContributors).toEqual([
      { author: 'alice', percent: 60, revisions: 30 },
      { author: 'bob', percent: 40, revisions: 20 },
    ]);
  });

  it('should use empty array fallback for topContributors', () => {
    const metrics = extractFileMetrics(mockForensics);
    const hotMetrics = metrics.find((m) => m.file === 'hot.ts');
    expect(hotMetrics!.topContributors).toEqual([]);
  });

  it('should not include percentiles by default', () => {
    const metrics = extractFileMetrics(mockForensics);
    const appMetrics = metrics.find((m) => m.file === 'app.ts');
    expect(appMetrics!.percentiles).toBeUndefined();
    expect(appMetrics!.riskScore).toBeUndefined();
  });

  it('should include percentiles when includePercentiles is true', () => {
    const metrics = extractFileMetrics(mockForensics, { includePercentiles: true });
    const appMetrics = metrics.find((m) => m.file === 'app.ts');

    expect(appMetrics!.percentiles).toBeDefined();
    expect(appMetrics!.percentiles!.revisions).toBeGreaterThan(0);
    expect(appMetrics!.percentiles!.churn).toBeGreaterThan(0);
    expect(appMetrics!.percentiles!.ownershipRisk).toBeGreaterThan(0);
    expect(appMetrics!.percentiles!.ageMonths).toBeGreaterThan(0);
    expect(appMetrics!.riskScore).toBeDefined();
    expect(appMetrics!.riskScore).toBeGreaterThan(0);
    expect(appMetrics!.riskScore).toBeLessThanOrEqual(100);
  });

  it('should accept custom risk weights with includePercentiles', () => {
    const defaultMetrics = extractFileMetrics(mockForensics, { includePercentiles: true });
    const customMetrics = extractFileMetrics(mockForensics, {
      includePercentiles: true,
      riskWeights: { revisions: 1.0, churn: 0, ownershipRisk: 0, age: 0, couplingScore: 0 },
    });

    const defaultApp = defaultMetrics.find((m) => m.file === 'app.ts')!;
    const customApp = customMetrics.find((m) => m.file === 'app.ts')!;
    expect(customApp.riskScore).not.toBe(defaultApp.riskScore);
  });
});
