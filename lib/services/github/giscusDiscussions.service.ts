import { unstable_cache } from "next/cache";
import { getGitHubAppToken } from "./github.utils";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const SIX_HOURS = 6 * 60 * 60;
const PAGE_SIZE = 100;
// Safety stop so a pagination bug can never loop forever. 100 pages = 10,000 discussions.
const MAX_PAGES = 100;

/**
 * giscus normally resolves a rule to its discussion with `mapping="specific"`, which
 * *searches* for a discussion titled with the rule GUID. When GitHub's discussion
 * search index is unavailable for the content repo, that search returns nothing and
 * every rule renders an empty comment box - see SSW.Rules#2765.
 *
 * The `discussions` connection used here is not search-backed, so it keeps working.
 * We build a GUID -> discussion number map from it and let giscus map by number.
 */
const GET_DISCUSSION_NUMBERS_QUERY = `
  query GetGiscusDiscussionNumbers($owner: String!, $name: String!, $categoryId: ID, $cursor: String) {
    repository(owner: $owner, name: $name) {
      discussions(first: ${PAGE_SIZE}, after: $cursor, categoryId: $categoryId) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          number
          title
          comments {
            totalCount
          }
        }
      }
    }
  }
`;

interface DiscussionNumberNode {
  number: number;
  title: string;
  comments: { totalCount: number };
}

async function fetchDiscussionNumbersByGuid(): Promise<Record<string, number>> {
  const org = process.env.NEXT_PUBLIC_GITHUB_ORG;
  const repoName = process.env.GISCUS_ACTIVITY_REPO_NAME ?? process.env.NEXT_PUBLIC_GISCUS_REPO_NAME;
  const categoryId = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID || null;

  if (!org || !repoName) {
    throw new Error("Missing NEXT_PUBLIC_GITHUB_ORG or GISCUS_ACTIVITY_REPO_NAME / NEXT_PUBLIC_GISCUS_REPO_NAME environment variables.");
  }

  const token = await getGitHubAppToken();
  // While discussion search was down, giscus could not find existing discussions and
  // created empty duplicates under the same GUID. Keep the busiest one, falling back
  // to the lowest number (the original) when comment counts tie, so a rule never maps
  // to an empty duplicate that shadows its real conversation.
  const best: Record<string, { number: number; comments: number }> = {};
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Rules.V3",
      },
      body: JSON.stringify({
        query: GET_DISCUSSION_NUMBERS_QUERY,
        variables: { owner: org, name: repoName, categoryId, cursor },
      }),
    });

    if (!res.ok) {
      throw new Error(`GitHub Discussions API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    if (json.errors?.length) {
      throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    const connection = json.data?.repository?.discussions;
    if (!connection) break;

    for (const node of (connection.nodes ?? []) as DiscussionNumberNode[]) {
      // giscus titles each discussion with the rule GUID.
      const guid = node?.title?.trim().toLowerCase();
      if (!guid || typeof node.number !== "number") continue;

      const comments = node.comments?.totalCount ?? 0;
      const incumbent = best[guid];

      if (!incumbent || comments > incumbent.comments || (comments === incumbent.comments && node.number < incumbent.number)) {
        best[guid] = { number: node.number, comments };
      }
    }

    if (!connection.pageInfo?.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }

  return Object.fromEntries(Object.entries(best).map(([guid, { number }]) => [guid, number]));
}

export const getCachedDiscussionNumbersByGuid = unstable_cache(fetchDiscussionNumbersByGuid, ["giscus-discussion-numbers"], {
  revalidate: SIX_HOURS,
  tags: ["giscus-discussion-numbers"],
});

/**
 * Returns the discussion number for a rule GUID, or null when there is no discussion
 * yet or the lookup fails. Callers fall back to `mapping="specific"` on null, so a
 * failure here degrades to today's behaviour rather than breaking the page.
 */
export async function getDiscussionNumberForGuid(guid?: string | null): Promise<number | null> {
  if (!guid) return null;

  try {
    const byGuid = await getCachedDiscussionNumbersByGuid();
    return byGuid[guid.trim().toLowerCase()] ?? null;
  } catch (error) {
    console.warn(`[giscusDiscussions] Could not resolve a discussion number for guid="${guid}":`, error);
    return null;
  }
}
