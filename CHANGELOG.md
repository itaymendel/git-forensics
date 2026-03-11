# Changelog

## 2.0.0

Replace absolute thresholds with percentile-based classification (P75/P90) and add composite risk scoring (`computeRiskScores`). Breaking: `InsightThresholds` shape rewritten, `InsightData` gains `percentile` field, stale-code severity promoted to warning/critical, generator signatures changed.

## 1.1.0

### Added

- `topContributors` metric — per-file ranked list of contributors with revision counts and percentages. Sorted by author count descending. Supports `topN` and `maxContributorsPerFile` options.
- README documentation for overriding insight thresholds and analysis options.
