import { NextRequest, NextResponse } from "next/server";
import { UpdateCategoryRequest } from "./types";

const isDev = process.env.NODE_ENV === "development";

/**
 * Validates the authorization header and returns the token if valid.
 */
export function validateAuth(request: NextRequest): {
  valid: boolean;
  token?: string;
  error?: NextResponse;
} {
  const authHeader = request.headers.get("authorization");

  if (!isDev && (!authHeader || !authHeader.startsWith("Bearer "))) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Missing Authorization token" }, { status: 401 }),
    };
  }

  const token = authHeader?.replace("Bearer ", "");
  return { valid: true, token };
}

/**
 * Validates the request body format.
 */
export function validateRequestBody(body: unknown): {
  valid: boolean;
  data?: UpdateCategoryRequest;
  error?: NextResponse;
} {
  if (typeof body !== "object" || body === null) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Invalid request body" }, { status: 400 }),
    };
  }

  const { categories, ruleUri, formType } = body as UpdateCategoryRequest;

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

  return { valid: true, data: { categories, ruleUri, formType } };
}
