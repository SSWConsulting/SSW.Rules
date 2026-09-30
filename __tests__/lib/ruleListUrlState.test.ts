import { DEFAULT_RULE_LIST_URL_STATE, parseRuleListSearch, toRuleListSearch } from "@/lib/ruleListUrlState";
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

  it("keeps unrelated params and removes params reset to default", () => {
    expect(toRuleListSearch({ ...DEFAULT_RULE_LIST_URL_STATE, page: 2 }, "?utm_source=x&page=4&archived=true")).toBe("?utm_source=x&page=2");
  });
});
