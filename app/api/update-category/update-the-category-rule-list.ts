import { TinaGraphQLClient } from "@/utils/tina/tina-graphql-client";
import { CATEGORY_FULL_QUERY, CATEGORY_FULL_QUERY_NO_INDEX, CATEGORY_RULE_PATHS_QUERY, RULE_PATH_BY_URI_QUERY, UPDATE_CATEGORY_MUTATION } from "./constants";
import {
  CategoryFullQueryResponse,
  CategoryIndexItem,
  CategoryMutationParams,
  CategoryQueryResponse,
  RuleConnectionQueryResponse,
  UpdateResult,
} from "./types";

const RULES_UPLOAD_PATH = "public/uploads/rules/";

/**
 * Extracts a relative path from a rule value (string or object).
 * This is a helper used by multiple functions to handle different rule value formats.
 */
function extractPathFromRuleValue(ruleValue: string | { _sys?: { relativePath?: string }; uri?: string } | undefined): string | null {
  if (!ruleValue) return null;

  // Handle case where rule is stored as a string
  if (typeof ruleValue === "string") {
    if (ruleValue.startsWith(RULES_UPLOAD_PATH)) {
      return ruleValue.replace(RULES_UPLOAD_PATH, "");
    }
    return ruleValue;
  }

  // Handle case where rule is an object
  if (typeof ruleValue === "object") {
    // First, try to get the path from _sys.relativePath (for existing rules)
    if (ruleValue._sys?.relativePath) {
      return ruleValue._sys.relativePath;
    }

    // If _sys.relativePath is not available, construct path from URI
    // This handles cases where the rule reference exists but the file doesn't yet
    if (ruleValue.uri && typeof ruleValue.uri === "string") {
      return `${ruleValue.uri}/rule.mdx`;
    }
  }

  return null;
}

/**
 * Extracts rule relative paths from a category query response.
 * Handles cases where rules don't have _sys.relativePath (e.g., newly added rules that don't exist yet).
 * Falls back to extracting the path from the rule string if _sys.relativePath is not available.
 */
function extractExistingRulePaths(categoryResponse: CategoryQueryResponse): string[] {
  const index = categoryResponse?.category?.index ?? [];

  return index.map((item) => extractPathFromRuleValue(item?.rule)).filter((path): path is string => typeof path === "string" && path.length > 0);
}

/**
 * Resolves the rule's relative path from its URI.
 */
async function resolveRulePath(ruleUri: string, tgc: TinaGraphQLClient): Promise<string | null> {
  try {
    const rulePathResponse = (await tgc.request(RULE_PATH_BY_URI_QUERY, {
      uris: [ruleUri],
    })) as RuleConnectionQueryResponse;

    const rulePath = rulePathResponse?.ruleConnection?.edges?.[0]?.node?._sys?.relativePath;

    return rulePath ?? null;
  } catch (error) {
    console.error(`Failed to resolve rule path for URI: ${ruleUri}`, error);
    return null;
  }
}

/**
 * Fetches the full category document to preserve existing fields.
 * Tries multiple strategies to ensure we get complete data:
 * 1. First tries with index (for update forms)
 * 2. Falls back to query without index if validation fails
 * 3. Returns null only if both queries fail completely
 */
async function fetchCategoryFull(
  relativePath: string,
  tgc: TinaGraphQLClient,
  skipValidation: boolean = false
): Promise<CategoryFullQueryResponse["category"] | null> {
  // For create forms, use query without index to avoid validation errors
  if (skipValidation) {
    try {
      const categoryFullResponse = (await tgc.request(CATEGORY_FULL_QUERY_NO_INDEX, {
        relativePath,
      })) as CategoryFullQueryResponse;
      return categoryFullResponse?.category ?? null;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch category ${relativePath} without index:`, error);
      return null;
    }
  }

  // For update forms: try with index first, then without index if validation fails
  try {
    const categoryFullResponse = (await tgc.request(CATEGORY_FULL_QUERY, {
      relativePath,
    })) as CategoryFullQueryResponse;
    return categoryFullResponse?.category ?? null;
  } catch (error) {
    // If query with index fails (likely due to non-existent rules in index), try without index
    console.warn(`⚠️ Failed to fetch category ${relativePath} with index, trying without index:`, error);
    try {
      const categoryFullResponse = (await tgc.request(CATEGORY_FULL_QUERY_NO_INDEX, {
        relativePath,
      })) as CategoryFullQueryResponse;
      return categoryFullResponse?.category ?? null;
    } catch (secondError) {
      console.error(`❌ Failed to fetch category ${relativePath} with both queries:`, secondError);
      return null;
    }
  }
}

/**
 * Removes undefined and null values from an object to avoid clearing fields.
 */
function pruneUndefinedAndNull<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined && value !== null)) as Partial<T>;
}

/**
 * Builds category mutation parameters from the current category data.
 */
function buildCategoryParams(currentCategory: CategoryFullQueryResponse["category"], newIndex: CategoryIndexItem[]): CategoryMutationParams {
  return pruneUndefinedAndNull({
    title: currentCategory?.title,
    uri: currentCategory?.uri,
    guid: currentCategory?.guid,
    consulting: currentCategory?.consulting,
    experts: currentCategory?.experts,
    redirects: Array.isArray(currentCategory?.redirects) ? currentCategory.redirects.filter((r): r is string => typeof r === "string") : undefined,
    body: currentCategory?.body,
    created: currentCategory?.created,
    createdBy: currentCategory?.createdBy,
    createdByEmail: currentCategory?.createdByEmail,
    lastUpdated: currentCategory?.lastUpdated,
    lastUpdatedBy: currentCategory?.lastUpdatedBy,
    lastUpdatedByEmail: currentCategory?.lastUpdatedByEmail,
    isArchived: currentCategory?.isArchived,
    archivedreason: currentCategory?.archivedreason,
    index: newIndex,
  });
}

/**
 * Constructs a rule path from its URI (for new rules that don't exist yet).
 */
function constructRulePathFromUri(ruleUri: string): string {
  // Rule paths are constructed as {uri}/rule.mdx based on the slugify function
  return `${ruleUri}/rule.mdx`;
}

/**
 * Gets existing rule paths for a category using GraphQL only.
 * Tries multiple strategies to get the rule paths.
 */
async function getExistingRulePaths(relativePath: string, tgc: TinaGraphQLClient, skipRulePathResolution: boolean): Promise<string[]> {
  // First, try the rule paths query (lightweight)
  try {
    const categoryRulePathsResponse = (await tgc.request(CATEGORY_RULE_PATHS_QUERY, { relativePath })) as CategoryQueryResponse;
    const graphqlRulePaths = extractExistingRulePaths(categoryRulePathsResponse);
    if (graphqlRulePaths.length > 0) {
      console.log(`📋 Category ${relativePath} currently has ${graphqlRulePaths.length} rule(s):`, graphqlRulePaths);
      return graphqlRulePaths;
    }
  } catch (error) {
    console.log(`⚠️ Rule paths query failed, trying full category query:`, error);
  }

  // Fall back to full category query to get rule paths
  try {
    const categoryFullResponse = (await tgc.request(CATEGORY_FULL_QUERY, { relativePath })) as CategoryFullQueryResponse;
    const index = (categoryFullResponse?.category as any)?.index || [];
    if (index.length > 0) {
      const paths = index.map((item: any) => extractPathFromRuleValue(item?.rule)).filter((path): path is string => path !== null && path.length > 0);
      if (paths.length > 0) {
        console.log(`📋 Category ${relativePath} has ${paths.length} rule(s) from full query:`, paths);
        return paths;
      }
    }
  } catch (error) {
    // If both queries fail, log warning and return empty array
    if (skipRulePathResolution) {
      console.log(`📋 Category ${relativePath} - create form, all GraphQL queries failed, assuming empty rule list`);
    } else {
      console.warn(`⚠️ All GraphQL queries failed for category ${relativePath}, assuming empty index:`, error);
    }
  }

  return [];
}

/**
 * Resolves or constructs the rule path based on the context.
 */
async function getRulePath(ruleUri: string, tgc: TinaGraphQLClient, skipRulePathResolution: boolean): Promise<string | null> {
  if (skipRulePathResolution) {
    // For create forms: construct path directly from URI without any query/resolution
    const rulePath = constructRulePathFromUri(ruleUri);
    console.log(`🔨 Constructed rule path from URI: ${rulePath} (for new rule - no resolution attempted)`);
    return rulePath;
  }

  // For update forms: resolve the path by querying the existing rule
  const rulePath = await resolveRulePath(ruleUri, tgc);
  console.log(`🔍 Resolved rule path from query: ${rulePath}`);
  return rulePath;
}

/**
 * Converts a rule value to CategoryIndexItem format for mutations.
 */
function convertRuleValueToIndexItem(ruleValue: any): CategoryIndexItem | null {
  if (typeof ruleValue === "string") {
    return { rule: ruleValue };
  }
  if (ruleValue?._sys?.relativePath) {
    return { rule: `${RULES_UPLOAD_PATH}${ruleValue._sys.relativePath}` };
  }
  if (ruleValue?.uri && typeof ruleValue.uri === "string") {
    return { rule: `${RULES_UPLOAD_PATH}${ruleValue.uri}/rule` };
  }
  return null;
}

/**
 * Gets the existing index from GraphQL, trying multiple strategies.
 * Returns the index in the format needed for mutations.
 */
async function getExistingIndexFromGraphQL(relativePath: string, tgc: TinaGraphQLClient): Promise<CategoryIndexItem[]> {
  // First, try to get index from the full category query (most complete)
  try {
    const categoryFullResponse = (await tgc.request(CATEGORY_FULL_QUERY, {
      relativePath,
    })) as CategoryFullQueryResponse;
    const index = (categoryFullResponse?.category as any)?.index || [];
    if (index.length > 0) {
      const convertedIndex = index.map((item: any) => convertRuleValueToIndexItem(item?.rule)).filter((item): item is CategoryIndexItem => item !== null);
      if (convertedIndex.length > 0) {
        return convertedIndex;
      }
    }
  } catch (error) {
    // If that fails, try the rule paths query
    console.log(`⚠️ Full category query failed, trying rule paths query:`, error);
  }

  // Fall back to rule paths query - construct index items from URIs
  try {
    const categoryRulePathsResponse = (await tgc.request(CATEGORY_RULE_PATHS_QUERY, {
      relativePath,
    })) as CategoryQueryResponse;
    const index = categoryRulePathsResponse?.category?.index || [];
    return index.map((item: any) => convertRuleValueToIndexItem(item?.rule)).filter((item): item is CategoryIndexItem => item !== null);
  } catch (error) {
    console.warn(`⚠️ Could not get index from GraphQL for category ${relativePath}:`, error);
    return [];
  }
}

/**
 * Gets the full category document with proper index handling using GraphQL only.
 * Uses multiple query strategies to ensure we get complete data even when some rules don't exist.
 */
async function getCategoryWithIndex(
  relativePath: string,
  tgc: TinaGraphQLClient,
  skipRulePathResolution: boolean
): Promise<CategoryFullQueryResponse["category"]> {
  const isCreateForm = skipRulePathResolution;
  if (isCreateForm) {
    console.log(`🔨 Create form - trying to fetch category with index first`);
  }

  // Try to fetch with index first
  let category = await fetchCategoryFull(relativePath, tgc, false);

  if (category) {
    // Successfully fetched with index, use it
    const graphqlIndex = (category as any)?.index || [];
    (category as any).index = graphqlIndex;
    return category;
  }

  // If fetching with index failed, try without index
  console.log(`⚠️ Failed to fetch category with index, trying without index`);
  category = await fetchCategoryFull(relativePath, tgc, true);

  if (!category) {
    throw new Error(`Failed to fetch category ${relativePath} via GraphQL. Cannot proceed without category data.`);
  }

  // If we had to fetch without index, get the existing index separately
  console.log(`📖 Attempting to get existing index separately to preserve existing rules`);
  const existingIndex = await getExistingIndexFromGraphQL(relativePath, tgc);
  (category as any).index = existingIndex;
  console.log(`📦 Preserved ${existingIndex.length} existing rule(s) from separate query`);
  return category;
}

/**
 * Normalizes paths for comparison to handle different formats consistently.
 */
function normalizePathForComparison(path: string | null): string | null {
  if (!path) return null;
  let normalized = path.trim();
  // Remove RULES_UPLOAD_PATH prefix if present
  if (normalized.startsWith(RULES_UPLOAD_PATH)) {
    normalized = normalized.replace(RULES_UPLOAD_PATH, "");
  }
  // Normalize slashes but keep the structure
  normalized = normalized.replace(/\/+/g, "/");
  // Remove trailing slashes except if it ends with /rule or /rule.mdx
  if (normalized.endsWith("/rule.mdx") || normalized.endsWith("/rule")) {
    return normalized;
  }
  return normalized.replace(/\/+$/, "");
}

/**
 * Extracts path from an index item for comparison.
 */
function getPathFromIndexItem(item: any): string | null {
  return extractPathFromRuleValue(item?.rule);
}

/**
 * Gets all possible path representations from an index item.
 * Returns normalized paths for comparison purposes.
 */
function getAllPathsFromIndexItem(item: any): string[] {
  const paths: string[] = [];
  const ruleValue = item?.rule;

  if (typeof ruleValue === "string") {
    let path = ruleValue;
    if (path.startsWith(RULES_UPLOAD_PATH)) {
      path = path.replace(RULES_UPLOAD_PATH, "");
    }
    paths.push(path);
  } else if (ruleValue && typeof ruleValue === "object") {
    if (ruleValue._sys?.relativePath) {
      paths.push(ruleValue._sys.relativePath);
    }
    if (ruleValue.uri && typeof ruleValue.uri === "string") {
      paths.push(`${ruleValue.uri}/rule.mdx`);
    }
  }

  return paths.map((p) => normalizePathForComparison(p)).filter((p): p is string => p !== null);
}

/**
 * Checks if an index item matches the rule to delete.
 */
function shouldDeleteIndexItem(item: any, ruleUri: string, normalizedRulePath: string | null): boolean {
  if (!normalizedRulePath) return false;

  const ruleValue = item?.rule;

  // First, try to match by URI (most reliable identifier)
  if (ruleValue && typeof ruleValue === "object") {
    const itemUri = ruleValue.uri;
    if (itemUri && typeof itemUri === "string" && itemUri === ruleUri) {
      return true;
    }
  }

  // Try to match by path
  const itemPaths = getAllPathsFromIndexItem(item);
  if (itemPaths.some((itemPath) => itemPath === normalizedRulePath)) {
    return true;
  }

  // For string items, check if the path matches or contains the URI
  if (typeof ruleValue === "string") {
    let cleanPath = ruleValue;
    if (cleanPath.startsWith(RULES_UPLOAD_PATH)) {
      cleanPath = cleanPath.replace(RULES_UPLOAD_PATH, "");
    }

    const normalizedStringPath = normalizePathForComparison(cleanPath);
    if (normalizedStringPath === normalizedRulePath) {
      return true;
    }

    // Check if the path can be constructed from URI
    const constructedPathFromUri = normalizePathForComparison(`${ruleUri}/rule.mdx`);
    if (normalizedStringPath === constructedPathFromUri) {
      return true;
    }

    // Fallback: check if path contains the URI
    if (normalizedStringPath?.includes(ruleUri) || cleanPath.includes(ruleUri)) {
      return true;
    }
  }

  return false;
}

/**
 * Preserves the exact format of existing index items.
 */
function preserveIndexItemFormat(item: any): CategoryIndexItem {
  const ruleValue = item?.rule;
  return {
    rule: typeof ruleValue === "string" ? ruleValue : `${RULES_UPLOAD_PATH}${getPathFromIndexItem(item) || ""}`,
  };
}

/**
 * Builds a new index for adding a rule.
 */
function buildIndexForAddAction(existingIndex: any[], rulePath: string): CategoryIndexItem[] {
  // Check if rule already exists in the index
  const ruleExists = existingIndex.some((item) => getPathFromIndexItem(item) === rulePath);
  if (ruleExists) {
    console.log(`⚠️ Rule path ${rulePath} already exists in category index, skipping duplicate add`);
    return existingIndex.map(preserveIndexItemFormat).filter((item) => item.rule);
  }

  // Add new rule to existing index, preserving existing items' exact string format
  return [...existingIndex.map(preserveIndexItemFormat), { rule: `${RULES_UPLOAD_PATH}${rulePath}` }];
}

/**
 * Builds a new index for deleting a rule.
 */
function buildIndexForDeleteAction(existingIndex: any[], ruleUri: string, rulePath: string): CategoryIndexItem[] {
  const normalizedRulePath = normalizePathForComparison(rulePath);
  console.log(`🗑️ Deleting rule with URI: ${ruleUri}, path: ${rulePath} (normalized: ${normalizedRulePath})`);

  const newIndex = existingIndex
    .filter((item) => {
      const shouldDelete = shouldDeleteIndexItem(item, ruleUri, normalizedRulePath);
      if (shouldDelete) {
        console.log(`✅ Found matching item to delete`);
      }
      return !shouldDelete;
    })
    .map(preserveIndexItemFormat);

  console.log(`📊 Delete operation: ${existingIndex.length} items before, ${newIndex.length} items after`);

  // If no items were deleted but we expected to delete one, log a warning
  if (existingIndex.length === newIndex.length) {
    console.warn(`⚠️ No items were deleted! Expected to delete rule with URI: ${ruleUri}, path: ${rulePath}`);
  }

  return newIndex;
}

/**
 * Updates a category's rule list by adding or deleting a rule.
 */
export async function updateTheCategoryRuleList(
  ruleUri: string,
  relativePath: string,
  tgc: TinaGraphQLClient,
  action: "add" | "delete" = "add",
  skipRulePathResolution: boolean = false
): Promise<UpdateResult> {
  // Declare rulePath outside try block so it's accessible in catch
  let rulePath: string | null = null;

  try {
    console.log(`🔄 Processing category ${relativePath} for rule ${ruleUri} (action: ${action}, skipResolution: ${skipRulePathResolution})`);

    // Step 1: Get existing rule paths from GraphQL
    const existingRulePaths = await getExistingRulePaths(relativePath, tgc, skipRulePathResolution);

    // Step 2: Resolve or construct the rule path
    rulePath = await getRulePath(ruleUri, tgc, skipRulePathResolution);
    if (!rulePath) {
      console.error(`❌ Could not resolve rule relativePath for URI: ${ruleUri}`);
      return { success: false, error: "Rule path not found" };
    }

    // Step 3: Validate preconditions
    const isUpdateForm = !skipRulePathResolution;
    const ruleAlreadyExists = existingRulePaths.includes(rulePath);

    if (isUpdateForm) {
      // For update forms, check if mutation is needed
      if (ruleAlreadyExists && action === "add") {
        console.log(`⏭️ Rule path already referenced in category ${relativePath}; skipping mutation.`);
        return { success: true };
      }
      if (!ruleAlreadyExists && action === "delete") {
        console.log(`⏭️ Rule path not found in category ${relativePath}; nothing to delete.`);
        return { success: true };
      }
    } else if (ruleAlreadyExists && action === "add") {
      // For create forms, log if rule path already exists (shouldn't happen for new rules)
      console.warn(
        `⚠️ Rule path ${rulePath} already exists in category ${relativePath} for new rule ${ruleUri}. This might indicate a duplicate or the rule was created before.`
      );
    }

    // Step 4: Get the full category document with proper index handling
    const currentCategory = await getCategoryWithIndex(relativePath, tgc, skipRulePathResolution);

    // Step 5: Get the existing index from the category document and ensure consistency
    let existingIndex: any[] = (currentCategory as any)?.index || [];

    // Reconstruct index if empty but we have existing rule paths
    // This handles cases where GraphQL queries fail due to indexing delays or validation issues
    if (existingIndex.length === 0 && existingRulePaths.length > 0) {
      console.log(`⚠️ Index is empty but we have ${existingRulePaths.length} existing rule path(s). Reconstructing index from paths.`);
      existingIndex = existingRulePaths.map((path) => ({
        rule: `${RULES_UPLOAD_PATH}${path}`,
      }));
      (currentCategory as any).index = existingIndex;
    } else if (existingIndex.length > 0 && existingRulePaths.length > 0) {
      // Ensure all paths from existingRulePaths are in the index
      // This handles cases where the index might be missing some rules due to GraphQL validation issues
      const indexPaths = existingIndex.map((item: any) => getPathFromIndexItem(item)).filter((p): p is string => p !== null);
      const missingPaths = existingRulePaths.filter((path) => !indexPaths.includes(path));
      if (missingPaths.length > 0) {
        console.log(`⚠️ Found ${missingPaths.length} rule path(s) missing from index. Adding them.`);
        const missingIndexItems = missingPaths.map((path) => ({
          rule: `${RULES_UPLOAD_PATH}${path}`,
        }));
        existingIndex = [...existingIndex, ...missingIndexItems];
        (currentCategory as any).index = existingIndex;
      }
    }

    console.log(
      `📦 Existing index has ${existingIndex.length} item(s), format:`,
      existingIndex.map((item: any) => ({
        ruleType: typeof item?.rule,
        ruleValue: typeof item?.rule === "string" ? item.rule.substring(0, 50) : "object",
      }))
    );

    // Step 6: Build new index based on action
    const newIndex = action === "add" ? buildIndexForAddAction(existingIndex, rulePath) : buildIndexForDeleteAction(existingIndex, ruleUri, rulePath);

    // Step 7: Check if the index actually changed (to detect duplicates)
    const expectedIndexForComparison = existingRulePaths.map((path) => ({
      rule: `${RULES_UPLOAD_PATH}${path}`,
    }));
    const indexChanged = JSON.stringify(newIndex) !== JSON.stringify(expectedIndexForComparison);

    if (!indexChanged && action === "add") {
      console.warn(`⚠️ Rule ${ruleUri} (path: ${rulePath}) already exists in category ${relativePath}. No mutation needed.`);
      return { success: true };
    }

    // Step 8: Build category parameters for mutation
    const categoryParams = buildCategoryParams(currentCategory, newIndex);

    // Step 9: Perform the mutation
    console.log(`🔧 Preparing mutation for category ${relativePath} with ${newIndex.length} rule(s) in index`);
    console.log(`🔧 New index will include rule path: ${rulePath} (full: ${RULES_UPLOAD_PATH}${rulePath})`);

    try {
      await tgc.request(UPDATE_CATEGORY_MUTATION, {
        relativePath,
        category: categoryParams,
      });
    } catch (mutationError) {
      console.error(`❌ GraphQL mutation failed for category ${relativePath}:`, mutationError);
      throw mutationError;
    }

    // Note: After mutation, TinaCMS may trigger re-indexing which can show errors like
    // "Unable to find collection for file" if the rule file doesn't exist yet.
    // These are expected and don't affect the mutation success - they're just indexing warnings.

    console.log(`✅ Successfully ${action === "add" ? "added" : "removed"} rule ${ruleUri} (path: ${rulePath}) to/from category ${relativePath}`);

    return { success: true };
  } catch (error) {
    const pathInfo = rulePath ? `(path: ${rulePath})` : "(path: not resolved)";
    console.error(`❌ Error ${action === "add" ? "adding" : "removing"} rule ${ruleUri} ${pathInfo} to/from category ${relativePath}:`, error);

    if (error instanceof Error) {
      console.error(`❌ Error details: ${error.message}`);
      console.error(`❌ Error stack:`, error.stack);
    }

    return { success: false, error };
  }
}
