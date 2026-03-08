// Core API
export { computeForensics } from './orchestrator.js';
export { getChangedFiles, transformGitLog } from './commit-log.js';
export type { TransformGitLogOptions } from './commit-log.js';

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
  FileCoupling,
  FileAge,
  FileOwnership,
  FileChurn,
  CommunicationPair,
  AuthorContribution,
  ContributorBreakdown,
  FileContributors,
  TruncationInfo,
  ForensicsMetadata,
  Forensics,
  BaseForensicsOptions,
  ForensicsOptions,
  ForensicsFromDataOptions,
  // Git input types (for data-driven API)
  GitLogData,
  GitLog,
  GitCommit,
  GitDiffFile,
} from './types.js';

// Preprocessing — for building custom pipelines
export { aggregateCommits } from './preprocessing/index.js';
export type {
  AggregateOptions,
  AggregatedStats,
  FileStats,
  CommitEntry,
} from './preprocessing/aggregate.js';

// Individual metrics — for composable analysis
export {
  computeRevisions,
  computeCoupledPairs,
  computeCouplingScore,
  computeCodeAge,
  computeOwnership,
  computeChurn,
  computeCommunication,
  computeTopContributors,
} from './metrics/index.js';
export type {
  RevisionsOptions,
  CoupledPairsOptions,
  CouplingScoreOptions,
  CodeAgeOptions,
  OwnershipOptions,
  ChurnOptions,
  CommunicationOptions,
  TopContributorsOptions,
} from './metrics/index.js';

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
