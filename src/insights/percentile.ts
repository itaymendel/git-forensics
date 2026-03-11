/** Midrank percentile: `(count_below + 0.5 * count_equal) / N * 100` */
export function percentileRank(value: number, distribution: readonly number[]): number {
  if (distribution.length === 0) return 0;

  let countBelow = 0;
  let countEqual = 0;
  for (const v of distribution) {
    if (v < value) countBelow++;
    else if (v === value) countEqual++;
  }

  return ((countBelow + 0.5 * countEqual) / distribution.length) * 100;
}

/** Reusable ranker: higher raw values → higher percentile ranks. */
export function createPercentileRanker(values: readonly number[]): (value: number) => number {
  const sorted = [...values].toSorted((a, b) => a - b);
  return (value: number) => percentileRank(value, sorted);
}

/** Inverted ranker: lower raw values → higher percentile ranks (e.g. fractalValue). */
export function createInvertedPercentileRanker(
  values: readonly number[]
): (value: number) => number {
  const sorted = [...values].toSorted((a, b) => a - b);
  return (value: number) => {
    if (sorted.length === 0) return 0;
    let countAbove = 0;
    let countEqual = 0;
    for (const v of sorted) {
      if (v > value) countAbove++;
      else if (v === value) countEqual++;
    }
    return ((countAbove + 0.5 * countEqual) / sorted.length) * 100;
  };
}
