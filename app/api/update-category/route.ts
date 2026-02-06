import { type NextRequest, NextResponse } from "next/server";
import { handleCreateForm, handleUpdateForm } from "./process-form";
import { validateAuth, validateRequestBody } from "./validation";
/**
 * Main POST handler for updating category associations with rules.
 *
 * Flow:
 * 1. Validate authorization
 * 2. Parse and validate request body
 * 3. Handle create vs update forms differently
 *    - Create: Add all categories directly (skip existence checks)
 *    - Update: Compare current vs requested categories, then add/delete as needed
 * 4. Return response with processed categories
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Step 1: Validate authorization
    const authValidation = validateAuth(request);
    if (!authValidation.valid) {
      return authValidation.error!;
    }

    // Step 2: Parse and validate request body
    const body = await request.json();
    const bodyValidation = validateRequestBody(body);
    if (!bodyValidation.valid) {
      return bodyValidation.error!;
    }

    const { categories, ruleUri, formType } = bodyValidation.data!;
    const token = authValidation.token || "";
    const activeBranch = request.cookies.get("x-branch")?.value;
    const isCreateForm = formType === "create";

    // Step 3: Handle create forms (simpler flow - just add all categories)
    if (isCreateForm) {
      return await handleCreateForm(categories, ruleUri, token);
    }

    // Step 4: Handle update forms (compare current vs requested, then add/delete)
    return await handleUpdateForm(categories, ruleUri, token);
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
