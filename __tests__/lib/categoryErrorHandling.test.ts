/**
 * Tests for graceful handling of missing/renamed rule references in categories.
 *
 * When a category references a rule that has been renamed or deleted,
 * the application should handle this gracefully instead of crashing with a 500 error.
 */

describe("Category rule filtering (defense-in-depth)", () => {
  /**
   * Simulates the filtering logic from ServerCategoryPage.tsx:
   * category.index.flatMap((i) => (i?.rule && i.rule.uri && i.rule.title ? [i.rule] : []))
   */
  function filterValidRules(index: any[]): any[] {
    return index.flatMap((i: any) => (i?.rule && i.rule.uri && i.rule.title ? [i.rule] : []));
  }

  it("filters out null rule references from category index", () => {
    const index = [
      { rule: { guid: "1", uri: "rule-one", title: "Rule One", isArchived: false } },
      { rule: null },
      { rule: { guid: "3", uri: "rule-three", title: "Rule Three", isArchived: false } },
    ];

    const result = filterValidRules(index);
    expect(result).toHaveLength(2);
    expect(result[0].uri).toBe("rule-one");
    expect(result[1].uri).toBe("rule-three");
  });

  it("filters out rules with missing uri", () => {
    const index = [
      { rule: { guid: "1", uri: "rule-one", title: "Rule One" } },
      { rule: { guid: "2", uri: undefined, title: "Missing URI" } },
      { rule: { guid: "3", uri: null, title: "Null URI" } },
    ];

    const result = filterValidRules(index);
    expect(result).toHaveLength(1);
    expect(result[0].uri).toBe("rule-one");
  });

  it("filters out rules with missing title", () => {
    const index = [
      { rule: { guid: "1", uri: "rule-one", title: "Rule One" } },
      { rule: { guid: "2", uri: "rule-two", title: undefined } },
      { rule: { guid: "3", uri: "rule-three", title: null } },
    ];

    const result = filterValidRules(index);
    expect(result).toHaveLength(1);
    expect(result[0].uri).toBe("rule-one");
  });

  it("handles completely empty index", () => {
    const result = filterValidRules([]);
    expect(result).toHaveLength(0);
  });

  it("handles index items with undefined rule", () => {
    const index = [{ rule: undefined }, {}, null].filter(Boolean);

    const result = filterValidRules(index);
    expect(result).toHaveLength(0);
  });

  it("keeps rules with missing guid (guid is optional for rendering)", () => {
    const index = [{ rule: { guid: undefined, uri: "rule-one", title: "Rule One" } }];

    const result = filterValidRules(index);
    expect(result).toHaveLength(1);
    expect(result[0].uri).toBe("rule-one");
  });
});

describe("Broken reference detection from error messages", () => {
  /**
   * Simulates the error parsing logic from getCategoryData in page.tsx
   */
  function extractBrokenPaths(errorMessage: string): string[] {
    const brokenPathMatches = errorMessage.matchAll(/Unable to find record ([^\n]+)/g);
    const brokenPaths = Array.from(brokenPathMatches, (match) => match[1].trim());
    return brokenPaths.length > 0 ? brokenPaths : ["unknown path"];
  }

  it("extracts a single broken path from error message", () => {
    const errorMessage = "Unable to find record public/uploads/rules/old-rule-name/rule.mdx";
    const paths = extractBrokenPaths(errorMessage);
    expect(paths).toEqual(["public/uploads/rules/old-rule-name/rule.mdx"]);
  });

  it("extracts multiple broken paths from error message", () => {
    const errorMessage = "Unable to find record public/uploads/rules/rule-a/rule.mdx\nUnable to find record public/uploads/rules/rule-b/rule.mdx";
    const paths = extractBrokenPaths(errorMessage);
    expect(paths).toEqual(["public/uploads/rules/rule-a/rule.mdx", "public/uploads/rules/rule-b/rule.mdx"]);
  });

  it("returns unknown path when no paths found in error message", () => {
    const errorMessage = "Some other error occurred";
    const paths = extractBrokenPaths(errorMessage);
    expect(paths).toEqual(["unknown path"]);
  });

  it("identifies record-not-found errors correctly", () => {
    const recordNotFoundError = "Unable to find record some/path.mdx";
    const otherError = "Network timeout";

    expect(recordNotFoundError.includes("Unable to find record")).toBe(true);
    expect(otherError.includes("Unable to find record")).toBe(false);
  });
});

describe("Rule list filtering (defense-in-depth)", () => {
  /**
   * Simulates the filtering logic from rule-list.tsx:
   * paginatedRules.filter((rule) => rule?.uri && rule?.title)
   */
  function filterRulesForRendering(rules: any[]): any[] {
    return rules.filter((rule) => rule?.uri && rule?.title);
  }

  it("filters out null rules", () => {
    const rules = [{ guid: "1", uri: "rule-one", title: "Rule One" }, null, { guid: "3", uri: "rule-three", title: "Rule Three" }];

    const result = filterRulesForRendering(rules);
    expect(result).toHaveLength(2);
  });

  it("filters out rules without uri or title", () => {
    const rules = [
      { guid: "1", uri: "rule-one", title: "Rule One" },
      { guid: "2", uri: undefined, title: "No URI" },
      { guid: "3", uri: "rule-three", title: null },
    ];

    const result = filterRulesForRendering(rules);
    expect(result).toHaveLength(1);
    expect(result[0].uri).toBe("rule-one");
  });
});
