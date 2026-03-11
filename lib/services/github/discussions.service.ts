import { unstable_cache } from "next/cache";
import { ActivityRule } from "@/models/ActivityRule";
import client from "@/tina/__generated__/client";
import { getGitHubAppToken } from "./github.utils";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const MAX_DISCUSSIONS = 200;
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GET_DISCUSSIONS_QUERY = `
  query GetDiscussionsByActivity($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      discussions(
        first: 100
        after: $cursor
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          title
          updatedAt
          comments {
            totalCount
          }
        }
      }
    }
  }
`;

interface DiscussionNode {
  title: string;
  updatedAt: string;
  comments: { totalCount: number };
}

/**
 * Fetches GitHub Discussions from the Giscus repo, ordered by most recently updated.
 * Paginates until MAX_DISCUSSIONS are collected or all pages are exhausted.
 */
async function fetchDiscussions(token: string, owner: string, repoName: string): Promise<DiscussionNode[]> {
  const discussions: DiscussionNode[] = [];
  let cursor: string | null = null;

  while (discussions.length < MAX_DISCUSSIONS) {
    const variables: Record<string, unknown> = { owner, name: repoName, cursor };

    const res = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Rules.V3",
      },
      body: JSON.stringify({ query: GET_DISCUSSIONS_QUERY, variables }),
    });

    if (!res.ok) {
      throw new Error(`GitHub Discussions API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    if (json.errors?.length) {
      throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    const page = json.data?.repository?.discussions;
    if (!page) break;

    discussions.push(...(page.nodes as DiscussionNode[]));

    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }

  return discussions;
}

/**
 * Fetches rules by GUID from TinaCMS and returns a map of guid → { title, uri }.
 */
async function fetchRulesByGuids(guids: string[]): Promise<Map<string, { title: string; uri: string }>> {
  const map = new Map<string, { title: string; uri: string }>();
  if (guids.length === 0) return map;

  const res = await client.queries.rulesByGuidQuery({ guids });
  const edges = res?.data?.ruleConnection?.edges ?? [];

  for (const edge of edges) {
    const node = edge?.node;
    if (node?.guid && node.title && node.uri) {
      map.set(node.guid, { title: node.title, uri: node.uri });
    }
  }

  return map;
}

/**
 * Returns rules sorted by most recent Giscus comment activity.
 * Results are cached for 6 hours via Next.js unstable_cache.
 */
export async function fetchActivityRules(): Promise<ActivityRule[]> {
  const org = process.env.NEXT_PUBLIC_GITHUB_ORG;
  const giscusRepoName = process.env.NEXT_PUBLIC_GISCUS_REPO_NAME;

  if (!org || !giscusRepoName) {
    throw new Error("Missing NEXT_PUBLIC_GITHUB_ORG or NEXT_PUBLIC_GISCUS_REPO_NAME environment variables.");
  }

  const token = await getGitHubAppToken();
  const discussions = await fetchDiscussions(token, org, giscusRepoName);

  // Discussion titles are rule GUIDs (Giscus "specific" mapping mode).
  // Filter to UUID-shaped titles to exclude any non-rule discussions.
  // Deduplicate, preserving first (most-recent) occurrence.
  const seenGuids = new Set<string>();
  const uniqueDiscussions: DiscussionNode[] = [];
  for (const d of discussions) {
    const guid = d.title.trim();
    if (GUID_REGEX.test(guid) && !seenGuids.has(guid)) {
      seenGuids.add(guid);
      uniqueDiscussions.push(d);
    }
  }

  const guids = uniqueDiscussions.map((d) => d.title.trim());
  const ruleMap = await fetchRulesByGuids(guids);

  const rules: ActivityRule[] = [];
  for (const discussion of uniqueDiscussions) {
    const guid = discussion.title.trim();
    const rule = ruleMap.get(guid);
    if (!rule) continue; // Skip discussions that don't map to a known rule

    rules.push({
      guid,
      title: rule.title,
      uri: rule.uri,
      lastCommentAt: discussion.updatedAt,
      commentCount: discussion.comments.totalCount,
    });
  }

  return rules;
}

const SIX_HOURS = 6 * 60 * 60;

export const getCachedActivityRules = unstable_cache(fetchActivityRules, ["github-discussions-activity"], {
  revalidate: SIX_HOURS,
  tags: ["github-discussions-activity"],
});
