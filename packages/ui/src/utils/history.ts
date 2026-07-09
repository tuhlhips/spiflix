export function getHistoryKey(item: { id: number; type: string }): string {
  return `${item.type}:${item.id}`
}

export function mergeHistory<T extends { id: number; type: string }>(
  existing: T[],
  incoming: T,
): T[] {
  const key = getHistoryKey(incoming)
  const filtered = existing.filter(i => getHistoryKey(i) !== key)
  return [incoming, ...filtered]
}
