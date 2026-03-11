# Changelog

## 2.0.0

### Breaking

- `InsightThresholds` shape rewritten - values are now percentile cutoffs (0-100), not raw metric values
- `InsightData` variants (except `coupling`) gain a `percentile` field
- Stale-code severity promoted from `info`/`warning` to `warning`/`critical`
- Generator function signatures changed (new `percentileRank` parameter)
- Finding strings now include `(Pxx)` percentile annotations

### Added

- Percentile-based classification (P75 = warning, P90 = critical) — self-calibrating across codebases
- `computeRiskScores` — composite 0-100 risk score per file with configurable weights
- `extractFileMetrics` accepts `includePercentiles` option for percentile-enriched metrics
- Percentile utilities: `percentileRank`, `createPercentileRanker`, `createInvertedPercentileRanker`
- New types: `PercentileThresholds`, `RiskWeights`, `FileRiskScore`, `ExtractFileMetricsOptions`

## 1.1.0

### Added

- `topContributors` metric — per-file ranked list of contributors with revision counts and percentages. Sorted by author count descending. Supports `topN` and `maxContributorsPerFile` options.
- README documentation for overriding insight thresholds and analysis options.
