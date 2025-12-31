// Core API
export { computeForensics } from './orchestrator.js';
export { getChangedFiles, transformGitLog } from './commit-log.js';

// Data-driven API (for use without git access)
export { computeForensicsFromData, gitLogDataSchema, validateGitLogData } from './from-data.js';

// CI Insights
export { generateInsights, extractFileMetrics, DEFAULT_THRESHOLDS } from './insights/index.js';

// Output types
export type {
  CommitLog,
  FileChange,
  FileRevisions,
  CoupledPair,
  FileSoc,
  FileAge,
  FileOwnership,
  FileChurn,
  CommunicationPair,
  AuthorContribution,
  ForensicsMetadata,
  Forensics,
  ForensicsOptions,
  ForensicsFromDataOptions,
  // Git input types (for data-driven API)
  GitLogData,
  GitLog,
  GitCommit,
  GitDiffFile,
} from './types.js';

// Stats types for building custom metrics
export type { AggregatedStats, FileStats, CommitEntry } from './preprocessing/aggregate.js';

// Insight types
export type {
  InsightType,
  InsightSeverity,
  InsightData,
  InsightFragments,
  FileInsight,
  FileMetrics,
  InsightThresholds,
  GenerateInsightsOptions,
} from './insights/index.js';
