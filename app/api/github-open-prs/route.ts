import { NextRequest, NextResponse } from "next/server";
import { getGitHubAppToken } from "@/lib/services/github/github.utils";
import { GITHUB_API_BASE_URL } from "@/lib/services/github/github.constants";

const CACHE_TTL = 300; // 5 minutes
const GITHUB_ACTIVE_BRANCH = process.env.NEXT_PUBLIC_TINA_BRANCH || "main";

const OPEN_PRS_QUERY = `
  query SearchOpenPRs($query: String!, $first: Int!) {
    search(query: $query, type: ISSUE, first: $first) {
      issueCount
    }
  }
`;

type CacheEntry = { expiresAt: number; hasOpenPRs: boolean };
const cache = new Map<string, CacheEntry>();

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get("owner") || "SSWConsulting";
  const repo = searchParams.get("repo") || "SSW.Rules.Content";
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ hasOpenPRs: false });
  }

  // Extract the rule folder name from the path (e.g. "content/rule/do-something/rule.mdx" -> "do-something")
  const ruleFolder = path.split("/").find((_, i, arr) => arr[i + 1] === "rule.mdx") || path.split("/").slice(-2, -1)[0] || "";

  if (!ruleFolder) {
    return NextResponse.json({ hasOpenPRs: false });
  }

  const cacheKey = `${owner}/${repo}/${ruleFolder}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ hasOpenPRs: cached.hasOpenPRs });
  }

  try {
    const token = await getGitHubAppToken();

    const query = `repo:${owner}/${repo} is:pr is:open ${ruleFolder}`;
    const response = await fetch(GITHUB_API_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Rules.V3",
      },
      body: JSON.stringify({
        query: OPEN_PRS_QUERY,
        variables: { query, first: 1 },
      }),
      next: { revalidate: CACHE_TTL },
    });

    if (!response.ok) {
      console.error("GitHub open PRs API error:", response.status);
      return NextResponse.json({ hasOpenPRs: false });
    }

    const result = await response.json();
    const issueCount = result?.data?.search?.issueCount ?? 0;
    const hasOpenPRs = issueCount > 0;

    cache.set(cacheKey, { hasOpenPRs, expiresAt: Date.now() + CACHE_TTL * 1000 });

    return NextResponse.json({ hasOpenPRs });
  } catch (err) {
    console.error("Error checking open PRs:", err);
    return NextResponse.json({ hasOpenPRs: false });
  }
}
