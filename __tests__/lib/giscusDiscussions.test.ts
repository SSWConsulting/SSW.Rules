/**
 * @jest-environment node
 */
import { unstable_cache } from "next/cache";
import { getDiscussionNumberForGuid } from "@/lib/services/github/giscusDiscussions.service";

jest.mock("next/cache", () => ({ unstable_cache: jest.fn((fn: unknown) => fn) }));
jest.mock("@/lib/services/github/github.utils", () => ({ getGitHubAppToken: jest.fn(async () => "token") }));

// The module calls unstable_cache one time, when it loads
const [, , cacheOptions] = (unstable_cache as jest.Mock).mock.calls[0];

const discussionsPage = (nodes: { number: number; title: string; comments: { totalCount: number } }[]) =>
  new Response(JSON.stringify({ data: { repository: { discussions: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } } }), { status: 200 });

describe("giscus discussion numbers", () => {
  const savedEnv = { ...process.env };
  const savedFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_GITHUB_ORG = "SSWConsulting";
    process.env.NEXT_PUBLIC_GISCUS_REPO_NAME = "SSW.Rules.Content";
  });
  afterEach(() => {
    process.env = { ...savedEnv };
    global.fetch = savedFetch;
  });

  // Each rule page calls the cached function, so a number here makes Next.js render each rule page again after that time
  it("gives the rule pages no revalidation period", () => {
    expect(cacheOptions.revalidate).toBeUndefined();
    expect(cacheOptions.tags).toEqual(["giscus-discussion-numbers"]);
  });

  it("resolves a rule GUID to the discussion that has the most comments", async () => {
    global.fetch = jest.fn(async () =>
      discussionsPage([
        { number: 12, title: "ABC-123", comments: { totalCount: 0 } },
        { number: 7, title: "abc-123 ", comments: { totalCount: 4 } },
        { number: 9, title: "other-guid", comments: { totalCount: 1 } },
      ])
    ) as unknown as typeof fetch;

    await expect(getDiscussionNumberForGuid(" ABC-123 ")).resolves.toBe(7);
    await expect(getDiscussionNumberForGuid("no-discussion-yet")).resolves.toBeNull();
  });

  // Keep this test last: after a failure, the service does not call GitHub for some minutes
  it("returns null when GitHub fails, so the page falls back to the search mapping", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = jest.fn(async () => new Response("", { status: 502, statusText: "Bad Gateway" })) as unknown as typeof fetch;

    await expect(getDiscussionNumberForGuid("abc-123")).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
