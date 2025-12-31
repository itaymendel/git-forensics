/** Insight types for PR annotations */
export type InsightType =
  | 'hotspot'
  | 'coupling'
  | 'ownership-risk'
  | 'stale-code'
  | 'high-churn'
  | 'soc';

/** Severity levels for insights */
export type InsightSeverity = 'info' | 'warning' | 'critical';

/** Type-specific data payloads */
export type InsightData =
  | { readonly type: 'hotspot'; readonly revisions: number; readonly rank: number }
  | {
      readonly type: 'coupling';
      readonly coupledWith: string;
      readonly percent: number;
      readonly bothInPR: boolean;
    }
  | {
      readonly type: 'ownership-risk';
      readonly fractalValue: number;
      readonly authorCount: number;
      readonly mainDev: string;
    }
  | { readonly type: 'stale-code'; readonly ageMonths: number; readonly lastModified: string }
  | {
      readonly type: 'high-churn';
      readonly churn: number;
      readonly added: number;
      readonly deleted: number;
    }
  | { readonly type: 'soc'; readonly soc: number; readonly rank: number };

/** Message fragments for easy annotation building */
export interface InsightFragments {
  readonly title: string;
  readonly finding: string;
  readonly risk: string;
  readonly suggestion: string;
}

/** A single insight for a file */
export interface FileInsight {
  readonly file: string;
  readonly type: InsightType;
  readonly severity: InsightSeverity;
  readonly data: InsightData;
  readonly fragments: InsightFragments;
}

/** Per-file metrics for server storage */
export interface FileMetrics {
  readonly file: string;
  readonly revisions: number;
  readonly ageMonths: number;
  readonly lastModified: string;
  readonly churn: number;
  readonly added: number;
  readonly deleted: number;
  readonly fractalValue: number;
  readonly mainDev: string;
  readonly authorCount: number;
  readonly coupledWith: readonly { readonly file: string; readonly percent: number }[];
}

/** Thresholds for insight generation */
export interface InsightThresholds {
  readonly hotspot: {
    readonly warning: number;
    readonly critical: number;
  };
  readonly coupling: {
    readonly minPercent: number;
    readonly warnIfMissingFromPR: boolean;
  };
  readonly ownershipRisk: {
    readonly warning: number;
    readonly critical: number;
    readonly minAuthors: number;
  };
  readonly staleCode: {
    readonly warning: number;
    readonly critical: number;
  };
  readonly churn: {
    readonly warning: number;
    readonly critical: number;
  };
  readonly soc: {
    readonly warning: number;
    readonly critical: number;
  };
}

/** Options for generateInsights */
export interface GenerateInsightsOptions {
  /** Filter insights to specific files (e.g., PR changed files). If omitted, generates for all files. */
  readonly files?: readonly string[];
  readonly thresholds?: Partial<InsightThresholds>;
  readonly minSeverity?: InsightSeverity;
}
