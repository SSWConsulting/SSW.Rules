import client from "@/tina/__generated__/client";

// Normalizes a category path to a consistent format for comparison
export function normalizeCategoryPathForComparison(
  categoryPath: string
): string {
  // Remove leading content/ or categories/ if present
  let normalized = categoryPath
    .replace(/^content\//, "")
    .replace(/^categories\//, "");

  // Ensure it ends with .mdx
  if (!normalized.endsWith(".mdx")) {
    normalized = `${normalized}.mdx`;
  }

  // Return with categories/ prefix for consistency
  return `categories/${normalized}`;
}

// Checks whether a rule with the given URI already exists in the provided
// category query result returned by `categoryWithRulesQuery`.
export function ruleExistsByUriInCategory(
  result: unknown,
  targetUri: string
): boolean {
  try {
    const category: any = (result as any)?.data?.category;
    const indexItems: any[] | undefined = category?.index;
    if (!Array.isArray(indexItems)) return false;

    return indexItems.some((item: any) => item?.rule?.uri === targetUri);
  } catch {
    return false;
  }
}

type CategoryStatus = "add" | "noChange" | "delete";

interface CategoryComparison {
  category: string;
  status: CategoryStatus;
}

/**
 * Compares current rule categories with requested categories and categorizes them.
 * @param currentCategories - Array of current category paths from the rule
 * @param requestedCategories - Array of requested category paths (can be strings or objects)
 * @returns Array of CategoryComparison objects with category path and status
 */
export function categorizeCategories(
  currentCategories: string[],
  requestedCategories: Array<string | { category?: string }>
): CategoryComparison[] {
  // Normalize requested categories to the same format
  const normalizedRequested = requestedCategories.map((cat) => {
    const rawPath =
      typeof cat === "string"
        ? cat
        : typeof cat?.category === "string"
        ? cat.category
        : "";
    return normalizeCategoryPathForComparison(rawPath);
  });

  // Normalize current categories (they might already have categories/ prefix)
  const normalizedCurrent = currentCategories.map((cat) => {
    // If it already has categories/ prefix, keep it; otherwise normalize it
    if (cat.startsWith("categories/")) {
      return cat;
    }
    return normalizeCategoryPathForComparison(cat);
  });

  // Create a Set for faster lookup
  const currentSet = new Set(normalizedCurrent);
  const requestedSet = new Set(normalizedRequested);

  const result: CategoryComparison[] = [];

  // Find categories to add (in requested but not in current)
  normalizedRequested.forEach((cat) => {
    if (!currentSet.has(cat)) {
      result.push({ category: cat, status: "add" });
    }
  });

  // Find categories with no change (in both lists)
  normalizedRequested.forEach((cat) => {
    if (currentSet.has(cat)) {
      result.push({ category: cat, status: "noChange" });
    }
  });

  // Find categories to delete (in current but not in requested)
  normalizedCurrent.forEach((cat) => {
    if (!requestedSet.has(cat)) {
      result.push({ category: cat, status: "delete" });
    }
  });

  return result;
}

export async function getRuleCategories(
  ruleUri: string
): Promise<{ rule: any; currentRuleCategories: string[] }> {
  const currentRule = await client.queries.rulesByUriQuery({ uris: [ruleUri] });
  const rule = currentRule?.data?.ruleConnection?.edges?.[0]?.node;

  if (!rule) {
    console.error("Rule not found for URI:", ruleUri);
    return { rule: null, currentRuleCategories: [] };
  }

  // Extract category relative paths from the nested structure: categories[].category._sys.relativePath
  const currentRuleCategories =
    rule?.categories
      ?.map((cat: any) => `categories/${cat?.category?._sys?.relativePath}`)
      .filter((path: string | undefined): path is string => !!path) || [];

  return { rule, currentRuleCategories };
}

export function getRelativePathForCategory(category: string): string {
  let relativePath = category
    .replace(/^content\//, "")
    .replace(/^categories\//, "");
  if (!relativePath.endsWith(".mdx")) {
    relativePath = `${relativePath}.mdx`;
  }
  return relativePath;
}
