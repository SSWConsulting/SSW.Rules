import {
  DEFAULT_RULE_LIST_URL_STATE,
  normalizeRuleListSearch,
  parseRuleListSearch,
  resolveCurrentPage,
  resolvePerPage,
  toPerPageState,
  toRuleListSearch,
} from "@/lib/ruleListUrlState";
import { RuleListFilter } from "@/types/ruleListFilter";

describe("parseRuleListSearch", () => {
  it("returns defaults for an empty query", () => {
    expect(parseRuleListSearch("")).toEqual(DEFAULT_RULE_LIST_URL_STATE);
  });

  it("reads page, perPage, view and archived", () => {
    expect(parseRuleListSearch("?page=3&perPage=50&view=titleOnly&archived=true")).toEqual({
      page: 3,
      perPage: 50,
      view: RuleListFilter.TitleOnly,
      includeArchived: true,
    });
  });

  it("reads perPage=all", () => {
    expect(parseRuleListSearch("?perPage=all").perPage).toBe("all");
  });

  it("falls back to defaults for invalid values", () => {
    expect(parseRuleListSearch("?page=0&perPage=-5&view=bogus&archived=yes")).toEqual(DEFAULT_RULE_LIST_URL_STATE);
    expect(parseRuleListSearch("?page=2.5&perPage=abc")).toEqual(DEFAULT_RULE_LIST_URL_STATE);
  });
});

describe("toRuleListSearch", () => {
  it("omits default values", () => {
    expect(toRuleListSearch(DEFAULT_RULE_LIST_URL_STATE, "")).toBe("");
  });

  it("writes non-default values", () => {
    const search = toRuleListSearch({ page: 2, perPage: 50, view: RuleListFilter.All, includeArchived: true }, "");
    expect(parseRuleListSearch(search)).toEqual({ page: 2, perPage: 50, view: RuleListFilter.All, includeArchived: true });
  });

  it("writes All as perPage=all", () => {
    expect(toRuleListSearch({ ...DEFAULT_RULE_LIST_URL_STATE, perPage: "all" }, "")).toBe("?perPage=all");
  });

  it("keeps unrelated params and removes params reset to default", () => {
    expect(toRuleListSearch({ ...DEFAULT_RULE_LIST_URL_STATE, page: 2 }, "?utm_source=x&page=4&archived=true")).toBe("?utm_source=x&page=2");
  });
});

describe("normalizeRuleListSearch", () => {
  it("keeps only valid, non-default list params in a fixed order", () => {
    expect(normalizeRuleListSearch("?utm_source=x&archived=true&page=2&view=blurb")).toBe("?page=2&archived=true");
    expect(normalizeRuleListSearch("?page=1")).toBe("");
  });
});

describe("per page 'All'", () => {
  it("stores a choice that covers the whole list as 'all'", () => {
    expect(toPerPageState(37, 37)).toBe("all");
    expect(toPerPageState(20, 37)).toBe(20);
  });

  it("keeps meaning All when the list grows", () => {
    expect(resolvePerPage("all", 37)).toBe(37);
    expect(resolvePerPage("all", 45)).toBe(45);
    expect(resolvePerPage(20, 45)).toBe(20);
  });
});

describe("resolveCurrentPage", () => {
  it("shows the last page for a page past the end", () => {
    expect(resolveCurrentPage(99, 2, true)).toBe(2);
    expect(resolveCurrentPage(2, 2, true)).toBe(2);
  });

  it("leaves the page alone when the caller paginates", () => {
    expect(resolveCurrentPage(3, 1, false)).toBe(3);
  });
});
