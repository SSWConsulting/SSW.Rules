import client from "@/tina/__generated__/client";
import { type NextRequest, NextResponse } from "next/server";
import { TinaGraphQLClient } from "@/utils/tina/tina-graphql-client";
import { updateTheCategoryRuleList } from "./update-the-category-rule-list";
import {
  categorizeCategories,
  getRelativePathForCategory,
  getRuleCategories,
  ruleExistsByUriInCategory,
} from "./util";
import {
  CategoryProcessingResult,
  UpdateCategoryRequest,
  UpdateCategoryResponse,
} from "./types";

const isDev = process.env.NODE_ENV === "development";

/**
 * Processes a single category for the given action (add or delete).
 * Returns whether the operation was successful.
 */
async function processSingleCategory(
  category: string,
  ruleUri: string,
  tgc: TinaGraphQLClient,
  action: "add" | "delete"
): Promise<boolean> {
  try {
    const relativePath = getRelativePathForCategory(category);
    const categoryQueryResult = await client.queries.categoryWithRulesQuery({
      relativePath,
    });
    const ruleAlreadyExists = ruleExistsByUriInCategory(
      categoryQueryResult,
      ruleUri
    );

    // Validate preconditions for the action
    if (action === "add" && ruleAlreadyExists) {
      return false; // Rule already exists, no change needed
    }
    if (action === "delete" && !ruleAlreadyExists) {
      return false; // Rule doesn't exist, no change needed
    }

    // Perform the update
    const result = await updateTheCategoryRuleList(
      ruleUri,
      relativePath,
      tgc,
      action
    );

    return result.success;
  } catch (error) {
    console.error(`Error processing category ${category}:`, error);
    return false;
  }
}

/**
 * Processes a list of categories for the given action.
 * Separates categories into processed and failed arrays.
 */
async function processCategories(
  categories: string[],
  ruleUri: string,
  tgc: TinaGraphQLClient,
  action: "add" | "delete"
): Promise<CategoryProcessingResult> {
  const processed: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    categories.map(async (category) => {
      const success = await processSingleCategory(
        category,
        ruleUri,
        tgc,
        action
      );

      const relativePath = getRelativePathForCategory(category);
      if (success) {
        processed.push(relativePath);
      } else {
        failed.push(relativePath);
      }
    })
  );

  return { processed, failed };
}

/**
 * Validates the authorization header and returns the token if valid.
 */
function validateAuth(request: NextRequest): {
  valid: boolean;
  token?: string;
  error?: NextResponse;
} {
  const authHeader = request.headers.get("authorization");

  if (!isDev && (!authHeader || !authHeader.startsWith("Bearer "))) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Missing Authorization token" },
        { status: 401 }
      ),
    };
  }

  const token = authHeader?.replace("Bearer ", "");
  return { valid: true, token };
}

/**
 * Validates the request body format.
 */
function validateRequestBody(body: unknown): {
  valid: boolean;
  data?: UpdateCategoryRequest;
  error?: NextResponse;
} {
  if (typeof body !== "object" || body === null) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      ),
    };
  }

  const { categories, ruleUri } = body as UpdateCategoryRequest;

  if (!Array.isArray(categories) || !ruleUri) {
    return {
      valid: false,
      error: NextResponse.json(
        {
          error: "Invalid data format - expected categories array and ruleUri",
        },
        { status: 400 }
      ),
    };
  }

  return { valid: true, data: { categories, ruleUri } };
}

/**
 * Extracts categories by status from categorized categories.
 */
function extractCategoriesByStatus(
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
    toAdd: categorizedCategories
      .filter((c) => c.status === "add")
      .map((c) => c.category),
    toDelete: categorizedCategories
      .filter((c) => c.status === "delete")
      .map((c) => c.category),
    noChange: categorizedCategories
      .filter((c) => c.status === "noChange")
      .map((c) => c.category),
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate authorization
    const authValidation = validateAuth(request);
    if (!authValidation.valid) {
      return authValidation.error!;
    }

    // Parse and validate request body
    const body = await request.json();
    const bodyValidation = validateRequestBody(body);
    if (!bodyValidation.valid) {
      return bodyValidation.error!;
    }

    const { categories, ruleUri } = bodyValidation.data!;
    const token = authValidation.token || "";

    // Get current rule and its categories
    const { rule, currentRuleCategories } = await getRuleCategories(ruleUri);

    if (!rule) {
      return NextResponse.json(
        { error: `Rule not found for URI: ${ruleUri}` },
        { status: 404 }
      );
    }

    // Categorize categories to determine actions needed
    const categorizedCategories = categorizeCategories(
      currentRuleCategories,
      categories
    );

    const { toAdd, toDelete, noChange } = extractCategoriesByStatus(
      categorizedCategories
    );

    // Process categories
    const tgc = new TinaGraphQLClient(token);
    const [addResult, deleteResult] = await Promise.all([
      processCategories(toAdd, ruleUri, tgc, "add"),
      processCategories(toDelete, ruleUri, tgc, "delete"),
    ]);

    // Build response
    const response: UpdateCategoryResponse = {
      success: true,
      message: `Processed categories for rule ${rule.title}`,
      URI: rule.uri,
      AddedCategories: addResult.processed,
      DeletedCategories: deleteResult.processed,
      NoChangedCategories: [
        ...addResult.failed,
        ...deleteResult.failed,
        ...noChange,
      ],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error processing category update:", error);
    return NextResponse.json(
      {
        error: "Failed to process category update",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
