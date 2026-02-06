import { NextResponse } from "next/server";
import client from "@/tina/__generated__/client";
import { TinaGraphQLClient } from "@/utils/tina/tina-graphql-client";
import { CategoryProcessingResult, UpdateCategoryResponse } from "./types";
import { updateTheCategoryRuleList } from "./update-the-category-rule-list";
import { categorizeCategories, getRelativePathForCategory, getRuleCategories, ruleExistsByUriInCategory } from "./util";

/**
 * Processes a single category for the given action (add or delete).
 *
 * @param category - Category path to process
 * @param ruleUri - URI of the rule to add/delete
 * @param tgc - Tina GraphQL client instance
 * @param action - Action to perform: "add" or "delete"
 * @param skipExistenceCheck - Skip GraphQL existence check (for create forms or when category has non-existent rules)
 * @returns Whether the operation was successful
 */
async function processSingleCategory(
  category: string,
  ruleUri: string,
  tgc: TinaGraphQLClient,
  action: "add" | "delete",
  skipExistenceCheck: boolean = false
): Promise<boolean> {
  try {
    const relativePath = getRelativePathForCategory(category);

    // Step 1: Validate preconditions (skip if skipExistenceCheck is true)
    // The existence check uses GraphQL which validates all rules in the category, including non-existent ones.
    // This causes errors when the category index contains references to rules that don't exist yet.
    if (!skipExistenceCheck) {
      try {
        const categoryQueryResult = await client.queries.categoryWithRulesQuery({ relativePath });
        const ruleAlreadyExists = ruleExistsByUriInCategory(categoryQueryResult, ruleUri);

        // Early return if no change is needed
        if (action === "add" && ruleAlreadyExists) {
          return false; // Rule already exists, no change needed
        }
        if (action === "delete" && !ruleAlreadyExists) {
          return false; // Rule doesn't exist, no change needed
        }
      } catch (error) {
        // If GraphQL query fails (e.g., due to non-existent rules), skip validation and proceed.
        // The updateTheCategoryRuleList function will handle reading from file to preserve existing rules.
        console.warn(
          `⚠️ Category existence check failed for ${relativePath} (likely due to non-existent rules in index). Skipping validation and proceeding with update.`,
          error
        );
      }
    }

    // Step 2: Perform the update
    // skipExistenceCheck is passed to skip rule path resolution when categories may contain non-existent rules.
    // The function will read from file to preserve existing rules and construct paths from URI when needed.
    const result = await updateTheCategoryRuleList(ruleUri, relativePath, tgc, action, skipExistenceCheck);

    if (!result.success) {
      console.error(`❌ Failed to process category ${category} (relativePath: ${getRelativePathForCategory(category)}):`, result.error);
    }
    return result.success;
  } catch (error) {
    console.error(`❌ Error processing category ${category}:`, error);
    return false;
  }
}

/**
 * Processes a list of categories for the given action.
 * Processes all categories in parallel and separates them into processed and failed arrays.
 *
 * @param categories - Array of category paths to process
 * @param ruleUri - URI of the rule to add/delete
 * @param tgc - Tina GraphQL client instance
 * @param action - Action to perform: "add" or "delete"
 * @param branch - Optional branch name
 * @param skipExistenceCheck - Skip GraphQL existence check
 * @returns Object with processed and failed category paths
 */
export async function processCategories(
  categories: string[],
  ruleUri: string,
  tgc: TinaGraphQLClient,
  action: "add" | "delete",
  skipExistenceCheck: boolean = false
): Promise<CategoryProcessingResult> {
  const processed: string[] = [];
  const failed: string[] = [];

  // Process all categories in parallel
  await Promise.all(
    categories.map(async (category) => {
      const relativePath = getRelativePathForCategory(category);
      const success = await processSingleCategory(category, ruleUri, tgc, action, skipExistenceCheck);

      if (success) {
        processed.push(relativePath);
        console.log(`✅ Successfully processed category: ${relativePath}`);
      } else {
        failed.push(relativePath);
        console.warn(`⏭️ Skipped category: ${relativePath} (action: ${action}, ruleUri: ${ruleUri})`);
      }
    })
  );

  return { processed, failed };
}

/**
 * Extracts categories by status from categorized categories.
 */
export function extractCategoriesByStatus(
  categorizedCategories: Array<{
    category: string;
    status: "add" | "noChange" | "delete";
  }>
): {
  toAdd: string[];
  toDelete: string[];
  noChange: string[];
} {
  return {
    toAdd: categorizedCategories.filter((c) => c.status === "add").map((c) => c.category),
    toDelete: categorizedCategories.filter((c) => c.status === "delete").map((c) => c.category),
    noChange: categorizedCategories.filter((c) => c.status === "noChange").map((c) => c.category),
  };
}

/**
 * Handles category updates for create forms.
 * Adds all provided categories directly without existence checks.
 */
export async function handleCreateForm(categories: Array<string | { category?: string }>, ruleUri: string, token: string): Promise<NextResponse> {
  const tgc = new TinaGraphQLClient(token);

  // Normalize categories to extract category paths
  const normalizedCategories = categories
    .map((cat) => {
      const rawPath = typeof cat === "string" ? cat : typeof cat === "object" && cat?.category ? cat.category : "";
      return rawPath;
    })
    .filter(Boolean);

  // Process all categories as "add" operations, skipping existence checks
  const addResult = await processCategories(
    normalizedCategories,
    ruleUri,
    tgc,
    "add",
    true // skipExistenceCheck = true for create forms
  );

  const response: UpdateCategoryResponse = {
    success: true,
    message: `Processed categories for new rule ${ruleUri}`,
    URI: ruleUri,
    AddedCategories: addResult.processed,
    DeletedCategories: [],
    NoChangedCategories: addResult.failed,
  };

  return NextResponse.json(response);
}

/**
 * Handles category updates for update forms.
 * Compares current rule categories with requested categories and processes changes.
 */
export async function handleUpdateForm(categories: Array<string | { category?: string }>, ruleUri: string, token: string): Promise<NextResponse> {
  // Get current rule and its categories
  const { rule, currentRuleCategories } = await getRuleCategories(ruleUri);

  if (!rule) {
    return NextResponse.json({ error: `Rule not found for URI: ${ruleUri}` }, { status: 404 });
  }

  // Categorize categories to determine what actions are needed
  const categorizedCategories = categorizeCategories(currentRuleCategories, categories);
  const { toAdd, toDelete, noChange } = extractCategoriesByStatus(categorizedCategories);

  // Process add and delete operations in parallel
  // Skip existence check because categories may contain non-existent rules.
  // The updateTheCategoryRuleList function will read from file to preserve existing rules.
  const tgc = new TinaGraphQLClient(token);
  const [addResult, deleteResult] = await Promise.all([
    processCategories(toAdd, ruleUri, tgc, "add", true), // skipExistenceCheck = true
    processCategories(toDelete, ruleUri, tgc, "delete", true), // skipExistenceCheck = true
  ]);

  const response: UpdateCategoryResponse = {
    success: true,
    message: `Processed categories for rule ${rule.title}`,
    URI: rule.uri,
    AddedCategories: addResult.processed,
    DeletedCategories: deleteResult.processed,
    NoChangedCategories: [...addResult.failed, ...deleteResult.failed, ...noChange],
  };

  return NextResponse.json(response);
}
