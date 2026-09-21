/**
 * @jest-environment node
 */
import { fetchAllArchivedRules, fetchArchivedRules } from "@/lib/services/rules/rules.service";
import client from "@/tina/__generated__/client";

jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/tina/__generated__/client", () => ({ __esModule: true, default: { queries: {}, request: jest.fn() } }));
// Importing the real documents pulls in tinacms' ESM build, which jest cannot transform.
jest.mock("@/tina/__generated__/types", () => ({ ArchivedRulesQueryDocument: "ArchivedRulesQueryDocument", CategoryRuleCountsQueryDocument: "CategoryRuleCountsQueryDocument" }));

const request = (client as any).request as jest.Mock;

const MISSING_RECORD = "Unable to find record categories/software-engineering/rules-to-better-sharepoint-for-developers.mdx";

const archivedRule = (uri: string, category: unknown = { uri: "cat", title: "Cat" }) => ({
  guid: uri,
  title: uri,
  uri,
  isArchived: true,
  archivedreason: "Obsolete",
  categories: [{ category }],
});

const page = (nodes: unknown[], pageInfo = { hasNextPage: false, endCursor: "" }, errors: unknown[] = []) => ({
  data: { ruleConnection: { pageInfo, edges: nodes.map((node) => ({ node })) } },
  errors,
});

beforeEach(() => jest.resetAllMocks());

describe("fetchArchivedRules", () => {
  it("keeps the archived rules when a rule points at a category that no longer exists", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    // Tina nulls the dangling `category` and reports it in `errors` rather than resolving the field.
    request.mockResolvedValue(page([archivedRule("still-here"), archivedRule("orphaned", null)], { hasNextPage: false, endCursor: "" }, [{ message: MISSING_RECORD }]));

    const { data } = await fetchArchivedRules({ first: 50 });

    expect(data.map((r) => r.uri)).toEqual(["still-here", "orphaned"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(MISSING_RECORD));
    warn.mockRestore();
  });

  it("asks Tina for partial data instead of letting a missing record throw", async () => {
    request.mockResolvedValue(page([archivedRule("a")]));

    await fetchArchivedRules({ first: 50 });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ query: "ArchivedRulesQueryDocument", errorPolicy: "all" }));
  });

  it("reports errors that are not a missing record", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    request.mockResolvedValue(page([archivedRule("a")], { hasNextPage: false, endCursor: "" }, [{ message: "Something else broke" }]));

    await fetchArchivedRules({ first: 50 });

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Something else broke"));
    error.mockRestore();
  });

  it("drops edges whose node came back null", async () => {
    request.mockResolvedValue(page([archivedRule("kept"), null]));

    const { data } = await fetchArchivedRules({ first: 50 });

    expect(data.map((r) => r.uri)).toEqual(["kept"]);
  });
});

describe("fetchAllArchivedRules", () => {
  it("keeps paginating past a page that carried a missing-record error", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    request
      .mockResolvedValueOnce(page([archivedRule("page-1", null)], { hasNextPage: true, endCursor: "cursor-1" }, [{ message: MISSING_RECORD }]))
      .mockResolvedValueOnce(page([archivedRule("page-2")], { hasNextPage: false, endCursor: "" }));

    const all = await fetchAllArchivedRules(50);

    expect(all.map((r) => r.uri)).toEqual(["page-1", "page-2"]);
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ variables: { first: 50, after: "cursor-1" } }));
    warn.mockRestore();
  });
});
