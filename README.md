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

Part exploration after dealing with such questions and digging online for good ways to get insights from the "meta" of coding, and part needing such library for some other tools I am looking to build.
While there are some great tools out there that can look at Git history and provide insights and reports ([git-of-theseus](https://github.com/erikbern/git-of-theseus), [code-maat](https://github.com/adamtornhill/code-maat), [git-fame](https://github.com/casperdcl/git-fame), [git-quick-stats](https://github.com/git-quick-stats/git-quick-stats),[MergeStat](https://github.com/mergestat/mergestat-lite), [Hercules](https://github.com/src-d/hercules), [gitinspector](https://github.com/ejwa/gitinspector)) - they "feel" heavy and not well suited to be backend for any dev-tool.

Lastly, while very enticing, I would not recommend running this on years of commits, but rather focus on more recent history (6-9 months of work). While you could do this for 20 years of code, and given this library does follows renames and such, history will make sense, but most of the data may get polluted given the long history.

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
```

## Example Output

Running `computeForensics` on a repository returns structured data across all metrics:

```jsonc
{
  "analyzedCommits": 842,
  "dateRange": { "from": "2024-03-10", "to": "2025-01-15" },
  "metadata": {
    "maxCommitsAnalyzed": 1000,
    "topN": 50,
    "totalFilesAnalyzed": 134,
    "totalAuthors": 12,
    "analyzedAt": "2025-01-20T14:32:00Z",
  },

  // Files changed most often — where bugs likely hide
  "hotspots": [
    { "file": "src/api/routes.ts", "revisions": 87, "exists": true },
    { "file": "src/core/engine.ts", "revisions": 64, "exists": true },
    { "file": "src/utils/helpers.ts", "revisions": 41, "exists": true },
  ],

  // Files that always change together — hidden dependencies
  "coupledPairs": [
    {
      "file1": "src/api/routes.ts",
      "file2": "src/api/middleware.ts",
      "couplingPercent": 82,
      "coChanges": 34,
      "file1Exists": true,
      "file2Exists": true,
    },
    {
      "file1": "src/db/schema.ts",
      "file2": "src/db/migrations.ts",
      "couplingPercent": 91,
      "coChanges": 22,
      "file1Exists": true,
      "file2Exists": true,
    },
  ],

  // Architectural hubs — files coupled to many others
  "couplingRankings": [
    { "file": "src/api/routes.ts", "couplingScore": 8, "exists": true },
    { "file": "src/core/engine.ts", "couplingScore": 5, "exists": true },
  ],

  // Stale code — unchanged for a long time
  "codeAge": [
    {
      "file": "src/legacy/parser.ts",
      "ageMonths": 14,
      "lastModified": "2023-11-02",
      "exists": true,
    },
    {
      "file": "src/utils/constants.ts",
      "ageMonths": 9,
      "lastModified": "2024-04-15",
      "exists": true,
    },
  ],

  // Knowledge silos — who owns what
  "ownership": [
    {
      "file": "src/core/engine.ts",
      "mainDev": "alice",
      "ownershipPercent": 34,
      "refactoringDev": "bob",
      "refactoringOwnership": 28,
      "fractalValue": 0.18,
      "authorCount": 7,
      "exists": true,
    },
    {
      "file": "src/api/routes.ts",
      "mainDev": "carol",
      "ownershipPercent": 62,
      "refactoringDev": "carol",
      "refactoringOwnership": 55,
      "fractalValue": 0.52,
      "authorCount": 4,
      "exists": true,
    },
  ],

  // Code volatility — lines added and deleted
  "churn": [
    {
      "file": "src/core/engine.ts",
      "added": 3200,
      "deleted": 1800,
      "churn": 5000,
      "revisions": 64,
      "exists": true,
    },
    {
      "file": "src/api/routes.ts",
      "added": 1400,
      "deleted": 600,
      "churn": 2000,
      "revisions": 87,
      "exists": true,
    },
  ],

  // Developer coordination needs (Conway's Law)
  "communication": [
    { "author1": "alice", "author2": "bob", "sharedEntities": 12, "strength": 67 },
    { "author1": "carol", "author2": "alice", "sharedEntities": 8, "strength": 45 },
  ],
}
```

Passing the result to `generateInsights` produces actionable alerts:

```jsonc
[
  {
    "file": "src/core/engine.ts",
    "type": "hotspot",
    "severity": "critical",
    "data": { "type": "hotspot", "revisions": 64, "rank": 2 },
    "fragments": {
      "title": "Hotspot",
      "finding": "64 revisions, ranked #2 in repository",
      "risk": "Top-ranked churn file — prioritize for refactoring or test hardening",
      "suggestion": "Consider breaking into smaller modules or adding test coverage",
    },
  },
  {
    "file": "src/core/engine.ts",
    "type": "high-churn",
    "severity": "critical",
    "data": { "type": "high-churn", "churn": 5000, "added": 3200, "deleted": 1800 },
    "fragments": {
      "title": "High Churn",
      "finding": "5,000 lines changed (+3,200 / -1,800)",
      "risk": "Frequent rewrites suggest unclear requirements or architectural friction",
      "suggestion": "Consider refactoring to stabilize this file",
    },
  },
  {
    "file": "src/core/engine.ts",
    "type": "ownership-risk",
    "severity": "critical",
    "data": {
      "type": "ownership-risk",
      "fractalValue": 0.18,
      "authorCount": 7,
      "mainDev": "alice",
    },
    "fragments": {
      "title": "Fragmented Ownership",
      "finding": "7 contributors, fragmentation score 0.18",
      "risk": "Diffuse ownership slows review cycles and increases merge conflicts",
      "suggestion": "Request review from alice (primary contributor)",
    },
  },
  {
    "file": "src/legacy/parser.ts",
    "type": "stale-code",
    "severity": "info",
    "data": { "type": "stale-code", "ageMonths": 14, "lastModified": "2023-11-02" },
    "fragments": {
      "title": "Stale Code",
      "finding": "Unchanged for 14 months (since Nov 2023)",
      "risk": "Untouched code drifts from current conventions and loses institutional knowledge",
      "suggestion": "Extra review recommended; verify tests still cover this code",
    },
  },
]
```

## Actionable Insights

Raw metrics are useful, but `generateInsights` transforms them into actionable alerts with human-readable messages:

```typescript
import { computeForensics, generateInsights } from 'git-forensics';

const forensics = await computeForensics(git);
const insights = generateInsights(forensics);

for (const insight of insights) {
  console.log(`${insight.file} — ${insight.fragments.title}`);
  console.log(`  ${insight.fragments.finding}`);
  console.log(`  ${insight.fragments.suggestion}`);
}
```

Each insight includes severity (`info`, `warning`, `critical`) and pre-composed fragments:

```typescript
insight.severity; // "warning" | "critical"
insight.fragments.title; // "Hotspot"
insight.fragments.finding; // "45 revisions, ranked #3 in repository"
insight.fragments.risk; // "Frequently changed files correlate with higher defect rates"
insight.fragments.suggestion; // "Consider breaking into smaller modules..."
```

### Insight thresholds

| Question                            | Metric             | Insight triggers when  |
| ----------------------------------- | ------------------ | ---------------------- |
| Where's the riskiest code?          | `hotspots`         | ≥25 revisions          |
| What keeps getting rewritten?       | `churn`            | ≥1000 lines churned    |
| What hidden dependencies exist?     | `coupledPairs`     | ≥70% co-change rate    |
| What has ripple effects?            | `couplingRankings` | Coupled to ≥5 files    |
| What's been forgotten?              | `codeAge`          | Unchanged ≥12 months   |
| Who owns what? Any knowledge silos? | `ownership`        | ≥3 authors, fragmented |

### Build your own insights

The `forensics.stats` field contains the complete temporal history—every commit, by every author, for every file:

```typescript
const forensics = await computeForensics(git);

// Access raw stats for custom analysis
for (const [file, fileStats] of Object.entries(forensics.stats.fileStats)) {
  // fileStats.byAuthor: Record<author, CommitEntry[]>
  // fileStats.authorContributions: Record<author, {additions, deletions, revisions}>
  // fileStats.totalRevisions, latestCommit, nameHistory, couplingScore
}
```

Ideas for custom metrics:

- **Temporal histograms** — Activity by week/month, burst detection (use `CommitEntry.date`)
- **Author expertise scores** — Weight recent changes higher (use `byAuthor` + recency)
- **Structural stability** — Files that move often signal architectural churn (use `nameHistory`)
- **Churn velocity** — Is volatility increasing or stabilizing? (use `CommitEntry.additions/deletions`)
- **Handoff detection** — Who leaves code for whom to modify? (use sequential authors in `byAuthor`)

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

git-forensics is fast (~700ms for 100k commits), for very large repos you can eliminate git history scans entirely by storing forensics data between runs.

**Step 1: Full analysis (scheduled or first run)**

```typescript
import { simpleGit } from 'simple-git';
import { computeForensics } from 'git-forensics';

const git = simpleGit();
const forensics = await computeForensics(git);

// Store on your server for later reuse
await fetch('https://your-server/api/forensics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    repo: 'your-org/your-repo',
    data: forensics,
  }),
});
```

**Step 2: Fast PR insights (no git scan needed)**

```typescript
import { simpleGit } from 'simple-git';
import { generateInsights, getChangedFiles } from 'git-forensics';

const git = simpleGit();

// Fetch pre-computed forensics from your server
const res = await fetch('https://your-server/api/forensics?repo=your-org/your-repo');
const forensics = await res.json();

// Generate insights only for PR changed files
const changedFiles = await getChangedFiles(git, 'origin/main');
const insights = generateInsights(forensics, {
  files: changedFiles,
  minSeverity: 'warning',
});
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
