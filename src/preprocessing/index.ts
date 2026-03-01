export { filterCommitFiles, normalizeAuthors } from './transforms.js';
export type { FilterOptions, AuthorOptions } from './transforms.js';

export { aggregateCommits } from './aggregate.js';
export type { AggregateOptions, AggregatedStats, FileStats, CommitEntry } from './aggregate.js';

export { enrichWithExistence, enrichWithExistenceFromSet } from './existence.js';
