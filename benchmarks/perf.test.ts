/**
 * Performance benchmark: 100K commits, 10K files, 60 developers.
 *
 * Run with:  npx vitest run benchmarks/perf.test.ts
 */
import { computeForensicsFromData } from '../src/from-data.js';
import { transformGitLog } from '../src/commit-log.js';
import { filterMergeCommits, computeForensicsCore } from '../src/orchestrator.js';
import {
  filterCommitFiles,
  normalizeAuthors,
  aggregateCommits,
  enrichWithExistenceFromSet,
} from '../src/preprocessing/index.js';
import { validateGitLogData } from '../src/from-data.js';
import type { GitLogData, GitCommit, CommitLog } from '../src/types.js';

// ── Config ──────────────────────────────────────────────
const NUM_COMMITS = 100_000;
const NUM_FILES = 10_000;
const NUM_DEVELOPERS = 60;
const HOT_FILE_COUNT = 500;

// ── Seeded PRNG (Mulberry32) for reproducibility ────────
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Data generation ─────────────────────────────────────
function generateMockData(): GitLogData {
  const rand = mulberry32(42);

  // File paths: 10 dirs × 10 subdirs × 100 files = 10,000
  const dirs = [
    'src',
    'lib',
    'api',
    'tests',
    'utils',
    'components',
    'services',
    'models',
    'config',
    'scripts',
  ];
  const subdirs = [
    'auth',
    'db',
    'ui',
    'core',
    'helpers',
    'types',
    'routes',
    'middleware',
    'hooks',
    'store',
  ];

  const files: string[] = [];
  for (let i = 0; i < NUM_FILES; i++) {
    const dir = dirs[i % dirs.length]!;
    const subdir = subdirs[Math.floor(i / dirs.length) % subdirs.length]!;
    files.push(`${dir}/${subdir}/file-${i}.ts`);
  }

  // Developer names
  const developers: string[] = [];
  for (let i = 0; i < NUM_DEVELOPERS; i++) {
    developers.push(`dev-${String(i).padStart(2, '0')}`);
  }

  // Build commits
  const commits: GitCommit[] = [];
  const baseDate = new Date('2022-01-01').getTime();
  const spanMs = 3 * 365 * 86_400_000; // ~3 years

  for (let i = 0; i < NUM_COMMITS; i++) {
    // Developer: top 10 devs get ~50% of commits (power-law-ish)
    const devIdx = rand() < 0.5 ? Math.floor(rand() * 10) : Math.floor(rand() * NUM_DEVELOPERS);

    // Files per commit: 1-8, exponential distribution centered around 2-3
    const numFiles = Math.min(1 + Math.floor(-Math.log(1 - rand()) * 2), 8);

    const commitFiles: { file: string; insertions: number; deletions: number }[] = [];
    const used = new Set<number>();

    for (let j = 0; j < numFiles; j++) {
      // 60% chance to pick from hot files, 40% from full pool
      const fileIdx =
        rand() < 0.6 ? Math.floor(rand() * HOT_FILE_COUNT) : Math.floor(rand() * NUM_FILES);

      if (used.has(fileIdx)) continue;
      used.add(fileIdx);

      commitFiles.push({
        file: files[fileIdx]!,
        insertions: 1 + Math.floor(rand() * 50),
        deletions: Math.floor(rand() * 20),
      });
    }

    if (commitFiles.length === 0) continue;

    const date = new Date(baseDate + (i / NUM_COMMITS) * spanMs);

    commits.push({
      hash: i.toString(16).padStart(7, '0'),
      date: date.toISOString(),
      author_name: developers[devIdx]!,
      message: `commit ${i}`,
      diff: { files: commitFiles },
    });
  }

  // trackedFiles: everything that appeared in any commit
  const tracked = new Set<string>();
  for (const c of commits) {
    for (const f of c.diff!.files!) {
      tracked.add(f.file);
    }
  }

  return {
    log: { all: commits },
    trackedFiles: [...tracked].join('\n'),
  };
}

// ── Helpers ─────────────────────────────────────────────
function time<T>(label: string, fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { result, ms };
}

// ── Tests ───────────────────────────────────────────────
describe('Performance: 100K commits × 10K files × 60 devs', () => {
  let data: GitLogData;

  beforeAll(() => {
    const { result, ms } = time('data generation', generateMockData);
    data = result;
    console.log(`\n  [setup] Data generation: ${ms.toFixed(0)}ms`);
    console.log(`  [setup] Commits: ${data.log.all.length.toLocaleString()}`);
    console.log(
      `  [setup] Tracked files: ${data.trackedFiles.split('\n').length.toLocaleString()}\n`
    );
  });

  it('full pipeline: computeForensicsFromData()', () => {
    const { result, ms } = time('full pipeline', () =>
      computeForensicsFromData(data, {
        topN: 100,
        skipMergeCommits: false,
      })
    );

    console.log('\n  ╔══════════════════════════════════════════╗');
    console.log('  ║   Full Pipeline Results                  ║');
    console.log('  ╠══════════════════════════════════════════╣');
    console.log(`  ║ Total time:        ${String(ms.toFixed(0) + 'ms').padEnd(20)}║`);
    console.log(
      `  ║ Commits analyzed:  ${String(result.analyzedCommits.toLocaleString()).padEnd(20)}║`
    );
    console.log(
      `  ║ Files analyzed:    ${String(result.metadata.totalFilesAnalyzed.toLocaleString()).padEnd(20)}║`
    );
    console.log(`  ║ Authors:           ${String(result.metadata.totalAuthors).padEnd(20)}║`);
    console.log(`  ║ Hotspots:          ${String(result.hotspots.length).padEnd(20)}║`);
    console.log(`  ║ Coupled pairs:     ${String(result.coupledPairs.length).padEnd(20)}║`);
    console.log(`  ║ Coupling rankings: ${String(result.couplingRankings.length).padEnd(20)}║`);
    console.log(`  ║ Ownership:         ${String(result.ownership.length).padEnd(20)}║`);
    console.log(`  ║ Communication:     ${String(result.communication.length).padEnd(20)}║`);
    console.log('  ╚══════════════════════════════════════════╝\n');

    expect(result.analyzedCommits).toBe(data.log.all.length);
    expect(result.metadata.totalAuthors).toBe(NUM_DEVELOPERS);
  });

  it('breakdown: individual pipeline phases', () => {
    const timings: { phase: string; ms: number }[] = [];

    // 1. Ajv validation
    const { ms: validateMs } = time('validate', () => validateGitLogData(data));
    timings.push({ phase: 'Ajv validation', ms: validateMs });

    // 2. transformGitLog
    const { result: commits, ms: transformMs } = time('transform', () =>
      transformGitLog(data.log, { detectRenames: true })
    );
    timings.push({ phase: 'transformGitLog', ms: transformMs });

    // 3. filterMergeCommits (skip in this case but measure anyway)
    const { result: filtered, ms: mergeMs } = time('mergeFilter', () =>
      filterMergeCommits(commits)
    );
    timings.push({ phase: 'filterMergeCommits', ms: mergeMs });

    // 4. filterCommitFiles (no exclude patterns, but measure the pass-through)
    const { result: filteredFiles, ms: filterMs } = time('filterFiles', () =>
      filterCommitFiles(filtered, {})
    );
    timings.push({ phase: 'filterCommitFiles', ms: filterMs });

    // 5. normalizeAuthors (no author map, but measure pass-through)
    const { result: normalized, ms: normalizeMs } = time('normalize', () =>
      normalizeAuthors(filteredFiles, {})
    );
    timings.push({ phase: 'normalizeAuthors', ms: normalizeMs });

    // 6. aggregateCommits (the heavy lifter)
    const { result: rawStats, ms: aggregateMs } = time('aggregate', () =>
      aggregateCommits(normalized, { maxFilesPerCommit: 50 })
    );
    timings.push({ phase: 'aggregateCommits', ms: aggregateMs });

    // 7. enrichWithExistence
    const trackedSet = new Set(data.trackedFiles.split('\n').filter(Boolean));
    const { result: stats, ms: enrichMs } = time('enrich', () =>
      enrichWithExistenceFromSet(rawStats, trackedSet)
    );
    timings.push({ phase: 'enrichWithExistence', ms: enrichMs });

    // 8. computeForensicsCore (all metrics)
    const { ms: coreMs } = time('core', () =>
      computeForensicsCore(normalized, stats, {
        topN: 100,
        minRevisions: 1,
        maxCommitsAnalyzed: normalized.length,
      })
    );
    timings.push({ phase: 'computeForensicsCore', ms: coreMs });

    // Print breakdown
    const total = timings.reduce((sum, t) => sum + t.ms, 0);

    console.log('\n  ┌──────────────────────────┬──────────┬────────┐');
    console.log('  │ Phase                    │ Time     │ %      │');
    console.log('  ├──────────────────────────┼──────────┼────────┤');
    for (const { phase, ms } of timings) {
      const pct = ((ms / total) * 100).toFixed(1);
      console.log(
        `  │ ${phase.padEnd(24)} │ ${(ms.toFixed(0) + 'ms').padStart(8)} │ ${(pct + '%').padStart(6)} │`
      );
    }
    console.log('  ├──────────────────────────┼──────────┼────────┤');
    console.log(
      `  │ ${'Sum (phases)'.padEnd(24)} │ ${(total.toFixed(0) + 'ms').padStart(8)} │ ${' 100%'.padStart(6)} │`
    );
    console.log('  └──────────────────────────┴──────────┴────────┘');

    // Quick stat on pair co-changes size
    const pairCount = Object.keys(rawStats.pairCoChanges).length;
    const fileCount = Object.keys(rawStats.fileStats).length;
    console.log(`\n  Aggregation stats:`);
    console.log(`    Unique files:      ${fileCount.toLocaleString()}`);
    console.log(`    Unique file pairs: ${pairCount.toLocaleString()}\n`);

    // Sanity check: all phases ran
    expect(timings.length).toBe(8);
  });
});
