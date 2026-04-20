import { unstable_cache } from "next/cache";
import { extractBodyPreview } from "@/lib/bodyUtils";
import { ActivityRule } from "@/models/ActivityRule";
import { RecentComment } from "@/models/RecentComment";
import client from "@/tina/__generated__/client";
import { getGitHubAppToken } from "./github.utils";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const MAX_DISCUSSIONS = 200;
const RECENT_COMMENTS_COUNT = 5;
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
          url
          updatedAt
          thumbsUp: reactions(content: THUMBS_UP) {
            totalCount
          }
          heart: reactions(content: HEART) {
            totalCount
          }
          rocket: reactions(content: ROCKET) {
            totalCount
          }
          hooray: reactions(content: HOORAY) {
            totalCount
          }
          thumbsDown: reactions(content: THUMBS_DOWN) {
            totalCount
          }
          confused: reactions(content: CONFUSED) {
            totalCount
          }
          comments(last: 1) {
            totalCount
            nodes {
              author {
                login
                avatarUrl
              }
              body
              createdAt
              url
            }
          }
        }
      }
    }
  }
`;

interface DiscussionCommentNode {
  author: { login: string; avatarUrl: string } | null;
  body: string;
  createdAt: string;
  url: string;
}

interface DiscussionNode {
  title: string;
  url: string;
  updatedAt: string;
  thumbsUp: { totalCount: number };
  heart: { totalCount: number };
  rocket: { totalCount: number };
  hooray: { totalCount: number };
  thumbsDown: { totalCount: number };
  confused: { totalCount: number };
  comments: {
    totalCount: number;
    nodes: DiscussionCommentNode[];
  };
}

/**
 * Strips common Markdown syntax to produce plain preview text.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → text
    .replace(/`{1,3}[^`\n]*`{1,3}/g, "") // inline code
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*{1,2}([^*\n]*)\*{1,2}/g, "$1") // bold/italic
    .replace(/_{1,2}([^_\n]*)_{1,2}/g, "$1") // underscore bold/italic
    .replace(/~~([^~\n]*)~~/g, "$1") // strikethrough
    .replace(/^[\s>]+/gm, "") // blockquotes
    .replace(/^[\s*\-+]+/gm, "") // unordered lists
    .replace(/\n+/g, " ") // newlines → space
    .trim();
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
 * Fetches rules by GUID from TinaCMS and returns a map of guid → metadata.
 */
async function fetchRulesByGuids(
  guids: string[]
): Promise<
  Map<string, { title: string; uri: string; authors: string[]; created: string | null; lastUpdated: string | null; lastUpdatedBy: string | null; body: any; categories: Array<{ title: string; uri: string }> }>
> {
  const map = new Map<
    string,
    { title: string; uri: string; authors: string[]; created: string | null; lastUpdated: string | null; lastUpdatedBy: string | null; body: any; categories: Array<{ title: string; uri: string }> }
  >();
  if (guids.length === 0) return map;

  const res = await client.queries.rulesByGuidQuery({ guids });
  const edges = res?.data?.ruleConnection?.edges ?? [];

  for (const edge of edges) {
    const node = edge?.node;
    if (node?.guid && node.title && node.uri) {
      const authors = (node.authors ?? []).map((a) => a?.title).filter((t): t is string => !!t);
      const categories = (node.categories ?? [])
        .map((c) => {
          const cat = c?.category;
          // __typename is not requested in rulesByGuidQuery; the inline fragment
          // guarantees that title/uri are present only for CategoryCategory nodes.
          if (cat && "title" in cat && cat.title) {
            return { title: cat.title, uri: ("uri" in cat ? (cat.uri as string) : null) ?? "" };
          }
          return null;
        })
        .filter((c): c is { title: string; uri: string } => !!c && !!c.title);

      map.set(node.guid, {
        title: node.title,
        uri: node.uri,
        authors,
        created: node.created ?? null,
        lastUpdated: node.lastUpdated ?? null,
        lastUpdatedBy: (node as any).lastUpdatedBy ?? null,
        body: node.body ?? null,
        categories,
      });
    }
  }

  return map;
}

export interface DiscussionData {
  activityRules: ActivityRule[];
  recentComments: RecentComment[];
}

/**
 * Fetches GitHub Discussions and returns both activity-ranked rules and recent comments.
 */
export async function fetchDiscussionData(): Promise<DiscussionData> {
  const org = process.env.NEXT_PUBLIC_GITHUB_ORG;
  // GISCUS_ACTIVITY_REPO_NAME is a server-only override for the discussions repo.
  // Falls back to NEXT_PUBLIC_GISCUS_REPO_NAME if not set.
  const giscusRepoName = process.env.GISCUS_ACTIVITY_REPO_NAME ?? process.env.NEXT_PUBLIC_GISCUS_REPO_NAME;

  if (!org || !giscusRepoName) {
    throw new Error("Missing NEXT_PUBLIC_GITHUB_ORG or GISCUS_ACTIVITY_REPO_NAME / NEXT_PUBLIC_GISCUS_REPO_NAME environment variables.");
  }

  const token = await getGitHubAppToken();
  const discussions = await fetchDiscussions(token, org, giscusRepoName);

  // Filter to UUID-shaped titles with at least 1 comment.
  // Deduplicate by GUID, preserving first (most-recent) occurrence.
  const seenGuids = new Set<string>();
  const uniqueDiscussions: DiscussionNode[] = [];
  for (const d of discussions) {
    const guid = d.title.trim();
    if (GUID_REGEX.test(guid) && d.comments.totalCount > 0 && !seenGuids.has(guid)) {
      seenGuids.add(guid);
      uniqueDiscussions.push(d);
    }
  }

  const guids = uniqueDiscussions.map((d) => d.title.trim());
  const ruleMap = await fetchRulesByGuids(guids);

  const activityRules: ActivityRule[] = [];

  // Collect (comment, ruleInfo) pairs for the recent comments list
  const commentCandidates: Array<{
    discussion: DiscussionNode;
    rule: { title: string; uri: string; authors: string[]; created: string | null; body: any; categories: Array<{ title: string; uri: string }> };
    comment: DiscussionCommentNode;
  }> = [];

  for (const discussion of uniqueDiscussions) {
    const guid = discussion.title.trim();
    const rule = ruleMap.get(guid);
    if (!rule) continue;

    activityRules.push({
      guid,
      title: rule.title,
      uri: rule.uri,
      lastCommentAt: discussion.updatedAt,
      commentCount: discussion.comments.totalCount,
      authors: rule.authors,
      created: rule.created,
      lastUpdated: rule.lastUpdated,
      lastUpdatedBy: rule.lastUpdatedBy,
      descriptionPreview: extractBodyPreview(rule.body),
      categories: rule.categories,
      thumbsUp: discussion.thumbsUp.totalCount + discussion.heart.totalCount + discussion.rocket.totalCount + discussion.hooray.totalCount,
      thumbsDown: discussion.thumbsDown.totalCount + discussion.confused.totalCount,
      discussionUrl: discussion.url,
    });

    const latestComment = discussion.comments.nodes[0];
    if (latestComment) {
      commentCandidates.push({ discussion, rule, comment: latestComment });
    }
  }

  // Sort candidates by comment createdAt descending and take the top N
  commentCandidates.sort((a, b) => new Date(b.comment.createdAt).getTime() - new Date(a.comment.createdAt).getTime());

  const recentComments: RecentComment[] = commentCandidates.slice(0, RECENT_COMMENTS_COUNT).map(({ discussion, rule, comment }) => ({
    guid: discussion.title.trim(),
    ruleTitle: rule.title,
    ruleUri: rule.uri,
    authorLogin: comment.author?.login ?? "ghost",
    authorAvatarUrl: comment.author?.avatarUrl ?? `https://avatars.githubusercontent.com/u/10137`,
    bodyPreview: stripMarkdown(comment.body).slice(0, 200),
    commentedAt: comment.createdAt,
  }));

  return { activityRules, recentComments };
}

const SIX_HOURS = 6 * 60 * 60;

export const getCachedDiscussionData = unstable_cache(fetchDiscussionData, ["github-discussion-data"], {
  revalidate: SIX_HOURS,
  tags: ["github-discussions-activity"],
});

/** Convenience wrapper — returns just the activity-ranked rules (used by the API route). */
export async function getCachedActivityRules(): Promise<ActivityRule[]> {
  const { activityRules } = await getCachedDiscussionData();
  return activityRules;
}
