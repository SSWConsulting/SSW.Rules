import { unstable_cache } from "next/cache";
import { GITHUB_API_BASE_URL, GITHUB_DISCUSSIONS_LATEST_COMMENTS_QUERY } from "@/lib/services/github/github.constants";
import { getGitHubAppToken } from "@/lib/services/github/github.utils";
import { LatestComment } from "@/models/LatestComment";

// Giscus discussion bodies contain a link back to the source rule page.
// Example body: "<!-- https://www.ssw.com.au/rules/rule-name/ -->"
function parseRuleUrlFromDiscussionBody(body: string): string | null {
  const match = body?.match(/<!--\s*(https?:\/\/[^\s]+)\s*-->/);
  return match?.[1] ?? null;
}

function extractRuleUriFromUrl(url: string, siteUrl: string): string {
  try {
    const parsed = new URL(url);
    // Strip leading slash, e.g. "/rules/rule-name/" → "rules/rule-name/"
    return parsed.pathname.replace(/^\//, "");
  } catch {
    return url;
  }
}

async function fetchLatestCommentsData(count = 5): Promise<LatestComment[]> {
  const owner = process.env.NEXT_PUBLIC_GITHUB_ORG;
  const repo = process.env.NEXT_PUBLIC_GISCUS_REPO_NAME;
  const categoryId = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID;

  if (!owner || !repo || !categoryId) {
    console.warn("[LatestComments] Missing Giscus env vars — skipping fetch");
    return [];
  }

  let token: string;
  try {
    token = await getGitHubAppToken();
  } catch (err) {
    console.error("[LatestComments] Failed to get GitHub token:", err);
    return [];
  }

  const response = await fetch(GITHUB_API_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: GITHUB_DISCUSSIONS_LATEST_COMMENTS_QUERY,
      variables: { owner, repo, categoryId, first: count * 3 },
    }),
  });

  if (!response.ok) {
    console.error("[LatestComments] GitHub API error:", response.status);
    return [];
  }

  const data = await response.json();
  const discussions: any[] = data?.data?.repository?.discussions?.nodes ?? [];

  const comments: LatestComment[] = [];

  for (const discussion of discussions) {
    const comment = discussion?.comments?.nodes?.[0];
    if (!comment?.author?.login) continue;

    const ruleUrl = parseRuleUrlFromDiscussionBody(discussion.body ?? "") ?? "";

    comments.push({
      authorLogin: comment.author.login,
      authorAvatarUrl: comment.author.avatarUrl,
      authorProfileUrl: comment.author.url,
      body: comment.body,
      createdAt: comment.createdAt,
      ruleTitle: discussion.title,
      ruleUrl,
      commentUrl: comment.url,
    });

    if (comments.length >= count) break;
  }

  return comments;
}

export async function fetchLatestComments(count = 5): Promise<LatestComment[]> {
  const getCachedLatestComments = unstable_cache(
    fetchLatestCommentsData,
    [`latest-comments-${count}`],
    { tags: ["latest-comments"] }
  );

  return getCachedLatestComments(count);
}
