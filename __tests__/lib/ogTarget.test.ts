/**
 * @jest-environment node
 */
import { resolveOgTarget } from "@/lib/og/target";
import client from "@/tina/__generated__/client";

jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/tina/__generated__/client", () => ({ __esModule: true, default: { queries: { mainCategoryQuery: jest.fn(), ruleDataBasic: jest.fn() } } }));

const queries = (client as any).queries;

const categories = (...filenames: string[]) => ({
  data: { category: { index: [{ top_category: { index: filenames.map((f) => ({ category: { _sys: { filename: f }, title: `Title of ${f}` } })) } }] } },
});

const rule = (title: string, authors: { title: string; url: string }[] = []) => ({ data: { rule: { title, authors } } });

beforeEach(() => jest.resetAllMocks());

describe("resolveOgTarget", () => {
  it("resolves a rule with its authors", async () => {
    queries.mainCategoryQuery.mockResolvedValue(categories("some-category"));
    queries.ruleDataBasic.mockResolvedValue(rule("Do you do the thing?", [{ title: "Adam Cogan", url: "x" }]));

    await expect(resolveOgTarget("do-the-thing")).resolves.toEqual({
      kind: "rule",
      title: "Do you do the thing?",
      authors: [{ title: "Adam Cogan", url: "x" }],
    });
  });

  it("resolves a category without querying for a rule", async () => {
    queries.mainCategoryQuery.mockResolvedValue(categories("rules-to-better-x"));

    await expect(resolveOgTarget("rules-to-better-x")).resolves.toEqual({ kind: "category", title: "Title of rules-to-better-x" });
    expect(queries.ruleDataBasic).not.toHaveBeenCalled();
  });

  it("falls back to the generic card on a genuine miss", async () => {
    queries.mainCategoryQuery.mockResolvedValue(categories("other"));
    queries.ruleDataBasic.mockRejectedValue(new Error("Unable to find record"));

    await expect(resolveOgTarget("no-such-page")).resolves.toEqual({ kind: "generic" });
  });

  // page.tsx serves unresolved filenames, so a card must never be worse than plain
  it("falls back to the generic card during an outage rather than failing", async () => {
    queries.mainCategoryQuery.mockRejectedValue(new Error("ECONNREFUSED"));
    queries.ruleDataBasic.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(resolveOgTarget("a-real-rule")).resolves.toEqual({ kind: "generic" });
  });

  it("still returns the rule when only the category lookup is down", async () => {
    queries.mainCategoryQuery.mockRejectedValue(new Error("ECONNREFUSED"));
    queries.ruleDataBasic.mockResolvedValue(rule("A rule"));

    await expect(resolveOgTarget("a-real-rule")).resolves.toMatchObject({ kind: "rule", title: "A rule" });
  });

  it("treats a rule with no title as not a rule", async () => {
    queries.mainCategoryQuery.mockResolvedValue(categories("other"));
    queries.ruleDataBasic.mockResolvedValue({ data: { rule: {} } });

    await expect(resolveOgTarget("untitled")).resolves.toEqual({ kind: "generic" });
  });
});
