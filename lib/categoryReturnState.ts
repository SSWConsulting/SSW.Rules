// Remembers where the reader left each category list in this tab, so a link back from a rule page
// can reopen the same page and scroll position. Storage can be unavailable (private mode, blocked
// site data); every caller must still work when it is.

const STORAGE_KEY = "ssw-rules:category-return";

// A restore request is only honoured for the navigation that made it. If that navigation never
// reaches the list (cancelled, blocked, failed), a later unrelated visit must not jump to the old position.
const RESTORE_REQUEST_TTL_MS = 30_000;

export interface CategoryReturnState {
  search: string;
  scrollY: number;
  restoreRequestedAt: number | null;
}

type CategoryReturnStore = Record<string, CategoryReturnState>;

function isCategoryReturnState(value: unknown): value is CategoryReturnState {
  const entry = value as CategoryReturnState;
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof entry.search === "string" &&
    typeof entry.scrollY === "number" &&
    (entry.restoreRequestedAt === null || typeof entry.restoreRequestedAt === "number")
  );
}

export function readCategoryReturnStates(): CategoryReturnStore {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) => isCategoryReturnState(entry)));
  } catch (error) {
    console.warn("[categoryReturnState] Could not read the saved category list positions:", error);
    return {};
  }
}

function writeStore(store: CategoryReturnStore) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn("[categoryReturnState] Could not save the category list position:", error);
  }
}

export function saveCategoryReturnState(categoryUri: string, search: string, scrollY: number) {
  const store = readCategoryReturnStates();
  store[categoryUri] = { search, scrollY, restoreRequestedAt: null };
  writeStore(store);
}

export function requestScrollRestore(categoryUri: string) {
  const store = readCategoryReturnStates();
  const entry = store[categoryUri];
  if (!entry) return;
  entry.restoreRequestedAt = Date.now();
  writeStore(store);
}

/** Returns the saved list query and scroll position once, if a return to this category was just requested. */
export function takeListReturnRequest(categoryUri: string): { search: string; scrollY: number } | null {
  const store = readCategoryReturnStates();
  const entry = store[categoryUri];
  if (!entry || entry.restoreRequestedAt === null) return null;

  const isFresh = Date.now() - entry.restoreRequestedAt <= RESTORE_REQUEST_TTL_MS;
  entry.restoreRequestedAt = null;
  writeStore(store);
  return isFresh ? { search: entry.search, scrollY: entry.scrollY } : null;
}
