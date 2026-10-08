const OPEN_EVENT = "rules-search:open";

export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenSearch(listener: () => void): () => void {
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

export const SEARCH_TRIGGER_ATTRIBUTE = "data-search-trigger";

// Where focus goes when something opened from search, such as The Rulekeeper, closes.
export function focusSearchTrigger() {
  const triggers = [...document.querySelectorAll<HTMLElement>(`[${SEARCH_TRIGGER_ATTRIBUTE}]`)];
  triggers.find((trigger) => trigger.getClientRects().length > 0)?.focus();
}
