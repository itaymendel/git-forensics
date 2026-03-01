export function withTopN<T>(results: T[], topN?: number): T[] {
  return topN && topN > 0 ? results.slice(0, topN) : results;
}

export function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = factory();
    map.set(key, value);
  }
  return value;
}

export function pushIfPresent<T>(arr: T[], item: T | null | undefined): void {
  if (item != null) arr.push(item);
}
