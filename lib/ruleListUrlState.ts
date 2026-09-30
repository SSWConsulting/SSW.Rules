import { RuleListFilter } from "@/types/ruleListFilter";

export interface RuleListUrlState {
  page: number;
  perPage: number;
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
    perPage: parsePositiveInt(params.get("perPage")) ?? DEFAULT_RULE_LIST_URL_STATE.perPage,
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
