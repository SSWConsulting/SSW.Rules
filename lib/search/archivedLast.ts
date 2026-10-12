// Search ranks by text match alone, so an archived rule can come first. Active rules go before archived ones; each group
// keeps the order it came in.
export function archivedLast<T extends { isArchived?: boolean | null }>(hits: T[]): T[] {
  return [...hits.filter((hit) => hit.isArchived !== true), ...hits.filter((hit) => hit.isArchived === true)];
}
