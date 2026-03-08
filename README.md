# git-forensics

A TypeScript library for providing insights from git commit history.

## Features

- **Actionable insights**
- **Fast - ~700ms for 100,000 commits (getting the git-log will be slow)**
- **Follows file rename and removal**
- **Optimized for CI**
- **Integrated (a VERY basic) [code complexity engine](https://github.com/itaymendel/indent-complexity)**
- **Bring your own code complexity score**
- **Add custom metrics using full temporal history**

## Motivation

Existing git analysis tools ([code-maat](https://github.com/adamtornhill/code-maat), [git-of-theseus](https://github.com/erikbern/git-of-theseus), [Hercules](https://github.com/src-d/hercules), etc.) are great for reports but feel heavy as a backend for dev-tools. This library is designed to be lightweight, fast, and embeddable.

> **Tip:** Focus on recent history (6-9 months). While the library handles renames and long histories correctly, older data tends to add noise.

## Installation

```bash
npm install git-forensics
```

## Quick Start

```typescript
import { simpleGit } from 'simple-git';
import { computeForensics } from 'git-forensics';

const git = simpleGit('/path/to/repo');
const forensics = await computeForensics(git);

forensics.hotspots; // Files changed most often
forensics.churn; // Code volatility (lines added/deleted)
forensics.coupledPairs; // Hidden dependencies
forensics.couplingRankings; // Architectural hubs
forensics.codeAge; // Stale code detection
forensics.ownership; // Knowledge silos
forensics.communication; // Developer coordination needs
forensics.topContributors; // Per-file contributor breakdown
```

## Example Output

Running `computeForensics` on a repository returns structured data across all metrics:

```jsonc
{
  "analyzedCommits": 842,
  "dateRange": { "from": "2024-03-10", "to": "2025-01-15" },
  "metadata": { "totalFilesAnalyzed": 134, "totalAuthors": 12 },

  "hotspots": [
    { "file": "src/api/routes.ts", "revisions": 87, "exists": true },
    { "file": "src/core/engine.ts", "revisions": 64, "exists": true },
  ],

  "coupledPairs": [
    {
      "file1": "src/api/routes.ts",
      "file2": "src/api/middleware.ts",
      "couplingPercent": 82,
      "coChanges": 34,
    },
  ],

  "ownership": [
    {
      "file": "src/core/engine.ts",
      "mainDev": "alice",
      "ownershipPercent": 34,
      "fractalValue": 0.18,
      "authorCount": 7,
    },
  ],

  // ... plus churn, codeAge, couplingRankings, communication, topContributors
}
```

Passing the result to `generateInsights` produces actionable alerts:

```jsonc
[
  {
    "file": "src/core/engine.ts",
    "type": "hotspot",
    "severity": "critical",
    "fragments": {
      "title": "Hotspot",
      "finding": "64 revisions, ranked #2 in repository",
      "risk": "Top-ranked churn file — prioritize for refactoring or test hardening",
      "suggestion": "Consider breaking into smaller modules or adding test coverage",
    },
  },
  {
    "file": "src/core/engine.ts",
    "type": "ownership-risk",
    "severity": "critical",
    "fragments": {
      "title": "Fragmented Ownership",
      "finding": "7 contributors, fragmentation score 0.18",
      "risk": "Diffuse ownership slows review cycles and increases merge conflicts",
      "suggestion": "Request review from alice (primary contributor)",
    },
  },
  // ... insights generated for each metric that exceeds thresholds
]
```

## Actionable Insights

`generateInsights` transforms metrics into alerts with severity (`info`, `warning`, `critical`) and human-readable fragments (`title`, `finding`, `risk`, `suggestion`).

### Insight thresholds

| Question                            | Metric             | Insight triggers when  |
| ----------------------------------- | ------------------ | ---------------------- |
| Where's the riskiest code?          | `hotspots`         | ≥25 revisions          |
| What keeps getting rewritten?       | `churn`            | ≥1000 lines churned    |
| What hidden dependencies exist?     | `coupledPairs`     | ≥70% co-change rate    |
| What has ripple effects?            | `couplingRankings` | Coupled to ≥5 files    |
| What's been forgotten?              | `codeAge`          | Unchanged ≥12 months   |
| Who owns what? Any knowledge silos? | `ownership`        | ≥3 authors, fragmented |

All thresholds are overridable — pass a partial `thresholds` object and only the values you specify will change:

```typescript
const insights = generateInsights(forensics, {
  thresholds: {
    hotspot: { warning: 50, critical: 100 },
    churn: { warning: 2000 },
    staleCode: { warning: 6, critical: 18 },
    coupling: { minPercent: 80 },
    ownershipRisk: { warning: 0.3, critical: 0.1, minAuthors: 4 },
    couplingScore: { warning: 8, critical: 15 },
  },
});
```

### Analysis options

The analysis pipeline has its own configurable thresholds that control what data is collected:

```typescript
const forensics = await computeForensics(git, {
  maxFilesPerCommit: 50, // skip large commits from coupling analysis (default: 50)
  minCoChanges: 3, // minimum co-changes to report a coupled pair (default: 3)
  minCouplingPercent: 30, // minimum coupling % to report a pair (default: 30)
  minSharedEntities: 2, // minimum shared files for communication pairs (default: 2)
});
```

These options are also available on `computeForensicsFromData()`.

### Build your own insights

`forensics.stats` contains the complete temporal history—every commit, by every author, for every file. Access `stats.fileStats[file].byAuthor`, `authorContributions`, `nameHistory`, etc. to build custom metrics like temporal histograms, expertise scores, or handoff detection.

## Complexity Analysis

git-forensics separates commit analysis from static code analysis. It provides optional complexity helpers for convenience (using [`indent-complexity`](https://github.com/itaymendel/indent-complexity)).
It is recommended you use a language-aware complexity scoring and pass the results to `computeForensics`.

## CI Usage

### Building a report

Loop over insights and build a PR comment or CI annotation:

```typescript
const insights = generateInsights(forensics, { minSeverity: 'warning' });

for (const insight of insights) {
  const prefix = insight.severity === 'critical' ? '[CRITICAL]' : '[WARNING]';
  console.log(`${prefix} ${insight.file} - ${insight.fragments.title}`);
  console.log(`  ${insight.fragments.finding}`);
  console.log(`  ${insight.fragments.suggestion}\n`);
}
```

### Optimization: Store & Reuse (large codebases)

For very large repos, store the `computeForensics` result between runs and rehydrate with `generateInsights` — no git scan needed:

```typescript
import { generateInsights, getChangedFiles } from 'git-forensics';

// Fetch pre-computed forensics from your server/cache
const forensics = await fetch('https://your-server/api/forensics?repo=org/repo').then((r) =>
  r.json()
);

// Generate insights only for PR changed files
const changedFiles = await getChangedFiles(git, 'origin/main');
const insights = generateInsights(forensics, { files: changedFiles, minSeverity: 'warning' });
```

## Data-Driven API

For environments without direct git access use `computeForensicsFromData()` with pre-fetched git data:

```typescript
import { computeForensicsFromData, gitLogDataSchema, validateGitLogData } from 'git-forensics';

// Data must match the following format
const data = {
  log: {
    all: [
      {
        hash: 'abc123',
        date: '2025-01-15T10:00:00Z',
        author_name: 'Alice',
        message: 'Add feature',
        diff: {
          files: [
            { file: 'src/app.ts', insertions: 50, deletions: 10 },
            { file: 'src/utils.ts', insertions: 20, deletions: 5 },
          ],
        },
      },
      // ... more commits
    ],
  },
  trackedFiles: 'src/app.ts\nsrc/utils.ts\nsrc/index.ts', // from git ls-files
};

// Print JSON-schema if needed
console.log(gitLogDataSchema); // JSON Schema object

// Validate before processing
validateGitLogData(data); // throws if invalid

const forensics = computeForensicsFromData(data);
```

## Attribution

Based on concepts from Adam Tornhill's [Your Code as a Crime Scene](https://pragprog.com/titles/atcrime2/your-code-as-a-crime-scene-second-edition/) and [Software Design X-Rays](https://pragprog.com/titles/atevol/software-design-x-rays/).

## License

MIT
