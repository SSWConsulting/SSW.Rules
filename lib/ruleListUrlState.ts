import { RuleListFilter } from "@/types/ruleListFilter";

// "all" rather than the rule count, so a saved link still shows every rule after the category grows
export type RuleListPerPage = number | "all";

export interface RuleListUrlState {
  page: number;
  perPage: RuleListPerPage;
  view: RuleListFilter;
  includeArchived: boolean;
}

export const DEFAULT_RULE_LIST_URL_STATE: RuleListUrlState = {
  page: 1,
  perPage: 20,
  view: RuleListFilter.Blurb,
  includeArchived: false,
};

const VIEWS: string[] = Object.values(RuleListFilter);

function parsePositiveInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 1 && Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseRuleListSearch(search: string): RuleListUrlState {
  const params = new URLSearchParams(search);
  const view = params.get("view");

  return {
    page: parsePositiveInt(params.get("page")) ?? DEFAULT_RULE_LIST_URL_STATE.page,
    perPage: params.get("perPage") === "all" ? "all" : (parsePositiveInt(params.get("perPage")) ?? DEFAULT_RULE_LIST_URL_STATE.perPage),
    view: view !== null && VIEWS.includes(view) ? (view as RuleListFilter) : DEFAULT_RULE_LIST_URL_STATE.view,
    includeArchived: params.get("archived") === "true",
  };
}

function setOrDelete(params: URLSearchParams, key: string, value: string | null) {
  if (value === null) params.delete(key);
  else params.set(key, value);
}

/** Builds the list query from `state`, keeping unrelated params from `currentSearch` and dropping defaults. */
export function toRuleListSearch(state: RuleListUrlState, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch);
  const defaults = DEFAULT_RULE_LIST_URL_STATE;

  setOrDelete(params, "page", state.page === defaults.page ? null : String(state.page));
  setOrDelete(params, "perPage", state.perPage === defaults.perPage ? null : String(state.perPage));
  setOrDelete(params, "view", state.view === defaults.view ? null : state.view);
  setOrDelete(params, "archived", state.includeArchived ? "true" : null);

  const query = params.toString();
  return query ? `?${query}` : "";
}

/** The list part of a query string only, in a fixed order, so two URLs for the same list compare equal. */
export function normalizeRuleListSearch(search: string): string {
  return toRuleListSearch(parseRuleListSearch(search), "");
}

export function toPerPageState(itemsPerPage: number, totalRules: number): RuleListPerPage {
  return itemsPerPage >= totalRules ? "all" : itemsPerPage;
}

export function resolvePerPage(perPage: RuleListPerPage, totalRules: number): number {
  return perPage === "all" ? totalRules : perPage;
}

/**
 * A page past the end (e.g. a stale ?page=5 on a list that has since shrunk) shows the last page instead of nothing.
 * A list that doesn't paginate itself gets `rules` already sliced by its caller, and the page only drives numbering.
 */
export function resolveCurrentPage(requestedPage: number, totalPages: number, listPaginates: boolean): number {
  return listPaginates ? Math.min(requestedPage, totalPages) : requestedPage;
}
