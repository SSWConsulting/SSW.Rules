/**
 * @jest-environment node
 */
const request = jest.fn();

jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
// The factory runs before the mock above is initialized, so it reads it only when a request is sent
jest.mock("@/tina/__generated__/client", () => ({
  __esModule: true,
  default: { request: (...args: unknown[]) => request(...args), queries: {} },
}));
jest.mock("@/tina/__generated__/types", () => ({ CategoryRuleCountsQueryDocument: "query categoryRuleCountsQuery" }));

import { fetchCategoryRuleCounts, fetchRuleCount } from "@/lib/services/rules/rules.service";

const THROTTLED = "Error retrieving data from DynamoDB: Throughput exceeds the current capacity of your table or index.";

const rule = (path: string) => ({ rule: { __typename: "Rule", isArchived: false, _sys: { relativePath: path } } });
const page = (errors: { message: string }[] | null, data: unknown = null) => ({ data, errors });
const counts = {
  categoryConnection: {
    edges: [{ node: { __typename: "CategoryCategory", _sys: { filename: "rules-to-better-email" }, index: [rule("a/rule.mdx"), rule("b/rule.mdx")] } }],
    pageInfo: { hasNextPage: false, endCursor: null },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  // Run the retry delays at once
  jest.spyOn(global, "setTimeout").mockImplementation(((callback: () => void) => {
    callback();
    return 0;
  }) as unknown as typeof setTimeout);
});

afterEach(() => jest.restoreAllMocks());

describe("category rule counts", () => {
  it("counts the rules of each category", async () => {
    request.mockResolvedValue(page(null, counts));

    await expect(fetchCategoryRuleCounts()).resolves.toEqual({ "rules-to-better-email": 2 });
    await expect(fetchRuleCount()).resolves.toBe(2);
  });

  it("keeps the counts when some rules are missing", async () => {
    request.mockResolvedValue(page([{ message: "Unable to find record public/uploads/rules/gone/rule.mdx" }], counts));

    await expect(fetchCategoryRuleCounts()).resolves.toEqual({ "rules-to-better-email": 2 });
  });

  it("retries a throttled page of categories", async () => {
    request.mockResolvedValueOnce(page([{ message: THROTTLED }])).mockResolvedValue(page(null, counts));

    await expect(fetchCategoryRuleCounts()).resolves.toEqual({ "rules-to-better-email": 2 });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not return empty counts as a success after a fatal error", async () => {
    request.mockResolvedValue(page([{ message: "Internal resolver error" }]));

    // The callers keep their old fallback (an empty result) after the error, but only after it is logged
    await expect(fetchCategoryRuleCounts()).resolves.toEqual({});
    expect(console.error).toHaveBeenCalledWith(
      "Failed to fetch category rule counts:",
      expect.objectContaining({ message: expect.stringContaining("Internal resolver error") })
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});
