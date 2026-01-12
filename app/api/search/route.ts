import { algoliasearch } from "algoliasearch";
import { NextRequest, NextResponse } from "next/server";
import * as appInsights from "applicationinsights";

// Simple in-memory rate limiter
// In production, consider using Redis or a service like Upstash for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per IP

function getRateLimitKey(request: NextRequest): string {
  // Use IP address for rate limiting
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || "unknown";
  return ip;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limit exceeded
  }

  record.count++;
  return true;
}

// Clean up old entries periodically (simple cleanup)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, RATE_LIMIT_WINDOW);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let searchQuery = "";

  try {
    // Check rate limit
    const rateLimitKey = getRateLimitKey(request);
    if (!checkRateLimit(rateLimitKey)) {
      // Track rate limit exceeded
      appInsights.defaultClient?.trackEvent({
        name: "RateLimitExceeded",
        properties: {
          endpoint: "/api/search",
          ip: rateLimitKey,
          limit: MAX_REQUESTS_PER_WINDOW,
          windowMs: RATE_LIMIT_WINDOW
        }
      });
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
    }

    // Parse request body
    const body = await request.json();
    const { requests } = body;

    if (!requests || !Array.isArray(requests)) {
      appInsights.defaultClient?.trackEvent({
        name: "SearchApiError",
        properties: {
          error: "Invalid request format",
          endpoint: "/api/search"
        }
      });
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }

    // Extract search query for tracking
    searchQuery = requests[0]?.params?.query || "";

    // Validate query length (minimum 3 characters)
    const hasValidQuery = requests.some((req: any) => {
      const query = req.params?.query || "";
      return query.trim().length >= 3 || query.trim().length === 0;
    });

    if (!hasValidQuery && requests.some((req: any) => req.params?.query)) {
      // If there's a query but it's less than 3 chars, return empty results
      return NextResponse.json({
        results: requests.map(() => ({
          hits: [],
          nbHits: 0,
          page: 0,
          nbPages: 0,
          hitsPerPage: 20,
          exhaustiveNbHits: false,
          query: "",
          params: "",
          processingTimeMS: 0,
        })),
      });
    }

    // Initialize Algolia client with server-side credentials
    const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
    const apiKey = process.env.ALGOLIA_SEARCH_API_KEY || process.env.NEXT_PUBLIC_ALGOLIA_API_KEY;

    if (!appId || !apiKey) {
      console.error("Algolia credentials not configured");
      appInsights.defaultClient?.trackException({
        exception: new Error("Algolia credentials not configured"),
        properties: {
          endpoint: "/api/search",
          severityLevel: 3
        }
      });
      return NextResponse.json({ error: "Search service not configured" }, { status: 500 });
    }

    const client = algoliasearch(appId, apiKey);
    const result = await client.search(requests);

    // Track successful search
    const duration = Date.now() - startTime;
    const firstResult = result.results?.[0];
    const resultCount = firstResult && 'nbHits' in firstResult ? firstResult.nbHits : 0;

    appInsights.defaultClient?.trackEvent({
      name: "SearchApiSuccess",
      properties: {
        query: searchQuery,
        resultCount,
        duration,
        ip: rateLimitKey
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Search API error:", error);

    // Track search error
    appInsights.defaultClient?.trackException({
      exception: error instanceof Error ? error : new Error(String(error)),
      properties: {
        endpoint: "/api/search",
        query: searchQuery,
        duration: Date.now() - startTime
      }
    });

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
