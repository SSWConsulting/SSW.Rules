const OPEN_EVENT = "rules-search:open";

export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenSearch(listener: () => void): () => void {
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
