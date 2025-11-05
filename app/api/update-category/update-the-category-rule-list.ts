import { TinaGraphQLClient } from "@/utils/tina/tina-graphql-client";
import {
  CATEGORY_FULL_QUERY,
  CATEGORY_RULE_PATHS_QUERY,
  RULE_PATH_BY_URI_QUERY,
  UPDATE_CATEGORY_MUTATION,
} from "./constants";
import {
  CategoryQueryResponse,
  RuleConnectionQueryResponse,
  CategoryFullQueryResponse,
  CategoryIndexItem,
  CategoryMutationParams,
  UpdateResult,
} from "./types";

const RULES_UPLOAD_PATH = "public/uploads/rules/";

/**
 * Extracts rule relative paths from a category query response.
 */
function extractExistingRulePaths(
  categoryResponse: CategoryQueryResponse
): string[] {
  const index = categoryResponse?.category?.index ?? [];
  return index
    .map((item) => item?.rule?._sys?.relativePath)
    .filter((path): path is string => typeof path === "string");
}

/**
 * Resolves the rule's relative path from its URI.
 */
async function resolveRulePath(
  ruleUri: string,
  tgc: TinaGraphQLClient
): Promise<string | null> {
  try {
    const rulePathResponse = (await tgc.request(RULE_PATH_BY_URI_QUERY, {
      uris: [ruleUri],
    })) as RuleConnectionQueryResponse;

    const rulePath =
      rulePathResponse?.ruleConnection?.edges?.[0]?.node?._sys?.relativePath;

    return rulePath ?? null;
  } catch (error) {
    console.error(`Failed to resolve rule path for URI: ${ruleUri}`, error);
    return null;
  }
}

/**
 * Fetches the full category document to preserve existing fields.
 */
async function fetchCategoryFull(
  relativePath: string,
  tgc: TinaGraphQLClient
): Promise<CategoryFullQueryResponse["category"]> {
  const categoryFullResponse = (await tgc.request(CATEGORY_FULL_QUERY, {
    relativePath,
  })) as CategoryFullQueryResponse;

  return categoryFullResponse?.category ?? {};
}

/**
 * Builds a new index array by adding a rule path.
 */
function buildIndexForAdd(
  existingRulePaths: string[],
  newRulePath: string
): CategoryIndexItem[] {
  const existingIndexItems = existingRulePaths.map((path) => ({
    rule: `${RULES_UPLOAD_PATH}${path}`,
  }));

  return [
    ...existingIndexItems,
    { rule: `${RULES_UPLOAD_PATH}${newRulePath}` },
  ];
}

/**
 * Builds a new index array by removing a rule path.
 */
function buildIndexForDelete(
  existingRulePaths: string[],
  rulePathToRemove: string
): CategoryIndexItem[] {
  return existingRulePaths
    .filter((path) => path !== rulePathToRemove)
    .map((path) => ({
      rule: `${RULES_UPLOAD_PATH}${path}`,
    }));
}

/**
 * Removes undefined and null values from an object to avoid clearing fields.
 */
function pruneUndefinedAndNull<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) => value !== undefined && value !== null
    )
  ) as Partial<T>;
}

/**
 * Builds category mutation parameters from the current category data.
 */
function buildCategoryParams(
  currentCategory: CategoryFullQueryResponse["category"],
  newIndex: CategoryIndexItem[]
): CategoryMutationParams {
  return pruneUndefinedAndNull({
    title: currentCategory?.title,
    uri: currentCategory?.uri,
    guid: currentCategory?.guid,
    consulting: currentCategory?.consulting,
    experts: currentCategory?.experts,
    redirects: Array.isArray(currentCategory?.redirects)
      ? currentCategory.redirects.filter(
          (r): r is string => typeof r === "string"
        )
      : undefined,
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
 * Updates a category's rule list by adding or deleting a rule.
 */
export async function updateTheCategoryRuleList(
  ruleUri: string,
  relativePath: string,
  tgc: TinaGraphQLClient,
  action: "add" | "delete" = "add"
): Promise<UpdateResult> {
  try {
    // Fetch existing rule paths in the category
    const categoryRulePathsResponse = (await tgc.request(
      CATEGORY_RULE_PATHS_QUERY,
      { relativePath }
    )) as CategoryQueryResponse;

    const existingRulePaths = extractExistingRulePaths(
      categoryRulePathsResponse
    );

    // Resolve the rule's relative path from its URI
    const rulePath = await resolveRulePath(ruleUri, tgc);

    if (!rulePath) {
      console.warn(`Could not resolve rule relativePath for URI: ${ruleUri}`);
      return { success: false, error: "Rule path not found" };
    }

    // Early return if rule already exists and we're trying to add
    if (existingRulePaths.includes(rulePath) && action === "add") {
      console.log(
        `Rule path already referenced in category ${relativePath}; skipping mutation.`
      );
      return { success: true };
    }

    // Early return if rule doesn't exist and we're trying to delete
    if (!existingRulePaths.includes(rulePath) && action === "delete") {
      console.log(
        `Rule path not found in category ${relativePath}; nothing to delete.`
      );
      return { success: true };
    }

    // Fetch full category document to preserve existing fields
    const currentCategory = await fetchCategoryFull(relativePath, tgc);

    // Build new index based on action
    const newIndex =
      action === "add"
        ? buildIndexForAdd(existingRulePaths, rulePath)
        : buildIndexForDelete(existingRulePaths, rulePath);

    // Build category parameters for mutation
    const categoryParams = buildCategoryParams(currentCategory, newIndex);

    // Perform the mutation
    await tgc.request(UPDATE_CATEGORY_MUTATION, {
      relativePath,
      category: categoryParams,
    });

    console.log(
      `Successfully ${
        action === "add" ? "added" : "removed"
      } rule ${ruleUri} from category ${relativePath}`
    );

    return { success: true };
  } catch (error) {
    console.error(
      `Error ${
        action === "add" ? "adding" : "removing"
      } rule ${ruleUri} from category ${relativePath}:`,
      error
    );
    return { success: false, error };
  }
}
