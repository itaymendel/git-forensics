import Ajv from 'ajv';
import type { Forensics, ForensicsFromDataOptions, GitLogData, CommitLog } from './types.js';
import { transformGitLog } from './commit-log.js';
import {
  filterCommitFiles,
  normalizeAuthors,
  aggregateCommits,
  enrichWithExistenceFromSet,
} from './preprocessing/index.js';
import { filterMergeCommits, computeForensicsCore } from './orchestrator.js';

/** JSON Schema for GitLogData - the complete input for computeForensicsFromData() */
export const gitLogDataSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'GitLogData',
  description: 'Input data for computeForensicsFromData(). Mirrors simple-git output format.',
  type: 'object',
  properties: {
    log: {
      type: 'object',
      properties: {
        all: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              hash: { type: 'string' },
              date: { type: 'string' },
              author_name: { type: 'string' },
              message: { type: 'string' },
              diff: {
                type: 'object',
                properties: {
                  files: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        file: { type: 'string' },
                        binary: { type: 'boolean' },
                        insertions: { type: 'number' },
                        deletions: { type: 'number' },
                      },
                      required: ['file'],
                    },
                  },
                },
              },
            },
            required: ['hash', 'date', 'author_name', 'message'],
          },
        },
      },
      required: ['all'],
    },
    trackedFiles: { type: 'string' },
  },
  required: ['log', 'trackedFiles'],
} as const;

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(gitLogDataSchema);

export function validateGitLogData(data: unknown): asserts data is GitLogData {
  if (validate(data)) return;

  const error = validate.errors?.[0];
  const path = error?.instancePath?.slice(1).replace(/\//g, '.') || 'root';
  const message = error?.message ?? 'validation failed';

  throw new Error(`Invalid GitLogData at ${path}: ${message}`);
}

function parseTrackedFiles(trackedFiles: string): Set<string> {
  return new Set(trackedFiles.trim().split('\n').filter(Boolean));
}

function validateFromDataOptions(options: ForensicsFromDataOptions): void {
  const { topN, minRevisions } = options;

  if (topN !== undefined && topN <= 0) {
    throw new Error(`topN must be positive, got ${topN}`);
  }
  if (minRevisions !== undefined && minRevisions < 0) {
    throw new Error(`minRevisions must be non-negative, got ${minRevisions}`);
  }
}

/**
 * Compute forensics from pre-fetched git data.
 *
 * Use this when you don't have direct git access.
 * The input data must match the format returned by simple-git's `git.log()` and `git.raw(['ls-files'])`.
 */
export function computeForensicsFromData(
  data: GitLogData,
  options: ForensicsFromDataOptions = {}
): Forensics {
  validateGitLogData(data);
  validateFromDataOptions(options);

  const {
    topN = 50,
    exclude,
    authorMap,
    minRevisions = 1,
    skipMergeCommits = true,
    followRenames = true,
    complexityScores,
  } = options;

  let commits: CommitLog[] = transformGitLog(data.log, { detectRenames: followRenames });

  if (skipMergeCommits) {
    commits = filterMergeCommits(commits);
  }

  commits = filterCommitFiles(commits, { exclude });
  commits = normalizeAuthors(commits, { authorMap });

  const rawStats = aggregateCommits(commits, { maxFilesPerCommit: 50 });
  const stats = enrichWithExistenceFromSet(rawStats, parseTrackedFiles(data.trackedFiles));

  const complexityMap = complexityScores ? new Map(Object.entries(complexityScores)) : undefined;

  return computeForensicsCore(commits, stats, {
    topN,
    minRevisions,
    complexity: complexityMap,
    maxCommitsAnalyzed: commits.length,
  });
}
