/** Insight types for PR annotations */
export type InsightType =
  | 'hotspot'
  | 'coupling'
  | 'ownership-risk'
  | 'stale-code'
  | 'high-churn'
  | 'coupling-score';

/** Severity levels for insights */
export type InsightSeverity = 'info' | 'warning' | 'critical';

/** Percentile-based thresholds for a metric */
export interface PercentileThresholds {
  readonly warning: number;
  readonly critical: number;
}

/** Type-specific data payloads */
export type InsightData =
  | {
      readonly type: 'hotspot';
      readonly revisions: number;
      readonly rank: number;
      readonly percentile: number;
    }
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
      readonly percentile: number;
    }
  | {
      readonly type: 'stale-code';
      readonly ageMonths: number;
      readonly lastModified: string;
      readonly percentile: number;
    }
  | {
      readonly type: 'high-churn';
      readonly churn: number;
      readonly added: number;
      readonly deleted: number;
      readonly percentile: number;
    }
  | {
      readonly type: 'coupling-score';
      readonly couplingScore: number;
      readonly rank: number;
      readonly percentile: number;
    };

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
  readonly topContributors: readonly {
    readonly author: string;
    readonly percent: number;
    readonly revisions: number;
  }[];
  readonly percentiles?: {
    readonly revisions: number;
    readonly churn: number;
    readonly ownershipRisk: number;
    readonly ageMonths: number;
    readonly couplingScore: number;
  };
  readonly riskScore?: number;
}

/** Thresholds for insight generation */
export interface InsightThresholds {
  readonly hotspot: PercentileThresholds;
  readonly coupling: {
    readonly minPercent: number;
    readonly warnIfMissingFromPR: boolean;
  };
  readonly ownershipRisk: PercentileThresholds & { readonly minAuthors: number };
  readonly staleCode: PercentileThresholds;
  readonly churn: PercentileThresholds;
  readonly couplingScore: PercentileThresholds;
}

/** Risk score weights for composite scoring */
export interface RiskWeights {
  readonly revisions: number;
  readonly churn: number;
  readonly ownershipRisk: number;
  readonly age: number;
  readonly couplingScore: number;
}

/** Computed risk score for a single file */
export interface FileRiskScore {
  readonly file: string;
  readonly riskScore: number;
  readonly breakdown: {
    readonly revisions: number;
    readonly churn: number;
    readonly ownershipRisk: number;
    readonly age: number;
    readonly couplingScore: number;
  };
}

/** Options for extractFileMetrics */
export interface ExtractFileMetricsOptions {
  readonly includePercentiles?: boolean;
  readonly riskWeights?: Partial<RiskWeights>;
}

/** Options for generateInsights */
export interface GenerateInsightsOptions {
  /** Filter insights to specific files (e.g., PR changed files). If omitted, generates for all files. */
  readonly files?: readonly string[];
  readonly thresholds?: Partial<InsightThresholds>;
  readonly minSeverity?: InsightSeverity;
}
