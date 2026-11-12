/**
 * @jest-environment node
 */
const ruleData = jest.fn();
const ruleDataBasic = jest.fn();
const topCategoryWithIndexQuery = jest.fn();
const request = jest.fn();

// The factory runs before the mocks above are initialized, so it reads them only when a query is called
jest.mock("@/tina/__generated__/client", () => ({
  __esModule: true,
  default: {
    queries: {
      ruleData: (...args: unknown[]) => ruleData(...args),
      ruleDataBasic: (...args: unknown[]) => ruleDataBasic(...args),
      topCategoryWithIndexQuery: (...args: unknown[]) => topCategoryWithIndexQuery(...args),
    },
    request: (...args: unknown[]) => request(...args),
  },
}));
jest.mock("@/tina/__generated__/types", () => ({ CategoryWithRulesQueryDocument: "query categoryWithRulesQuery" }));

import { getCategoryData, getRuleData } from "@/app/[filename]/pageData";

const graphqlError = (message: string) =>
  new Error(`Unable to fetch, please see our FAQ for more information: https://tina.io/docs/r/FAQ/\n      Errors: \n\t${message}`);
const THROTTLED = "Error retrieving data from DynamoDB: Throughput exceeds the current capacity of your table or index.";
const throttled = () => graphqlError(THROTTLED);
const notFound = (path: string) => graphqlError(`Unable to find record ${path}`);

const rule = { title: "Do you fix bugs first?", guid: "abc", related: [{ rule: { uri: "other" } }] };
const ruleResult = (data: object) => ({
  data: { rule: { ...rule, ...data } },
  query: "query ruleData",
  variables: { relativePath: "fix-bugs-first/rule.mdx" },
});

const topCategories = (filename: string) => ({
  data: {
    categoryConnection: {
      edges: [
        {
          node: { __typename: "CategoryTop_category", _sys: { relativePath: "software-engineering/index.mdx" }, index: [{ category: { _sys: { filename } } }] },
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
});

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

describe("getRuleData", () => {
  it("sends one request for a rule with valid related rules", async () => {
    ruleData.mockResolvedValue(ruleResult({}));

    const result = await getRuleData("fix-bugs-first");

    expect(result?.data.rule.title).toBe("Do you fix bugs first?");
    expect(result?.brokenReferences).toBeNull();
    expect(ruleData).toHaveBeenCalledTimes(1);
    expect(ruleDataBasic).not.toHaveBeenCalled();
  });

  it("keeps every Tina request out of the Next data cache, so a retry is a new request", async () => {
    topCategoryWithIndexQuery.mockResolvedValue(topCategories("rules-to-better-email"));
    request.mockResolvedValue({ data: { category: { title: "Rules to Better Email" } }, errors: null });
    ruleData.mockResolvedValue(ruleResult({}));

    await getCategoryData("rules-to-better-email");
    await getRuleData("fix-bugs-first");

    const noStore = { fetchOptions: { cache: "no-store" } };
    expect(topCategoryWithIndexQuery).toHaveBeenCalledWith(expect.anything(), noStore);
    expect(request).toHaveBeenCalledWith(expect.anything(), noStore);
    expect(ruleData).toHaveBeenCalledWith(expect.anything(), noStore);
  });

  it("retries a throttled request and does not report a broken reference", async () => {
    ruleData.mockRejectedValueOnce(throttled()).mockRejectedValueOnce(throttled()).mockResolvedValue(ruleResult({}));

    const result = await getRuleData("fix-bugs-first");

    expect(result?.brokenReferences).toBeNull();
    expect(result?.data.rule.related).toHaveLength(1);
    expect(ruleData).toHaveBeenCalledTimes(3);
    expect(ruleDataBasic).not.toHaveBeenCalled();
  });

  it("throws when the throttling does not stop, so no fallback page is rendered", async () => {
    ruleData.mockRejectedValue(throttled());

    await expect(getRuleData("fix-bugs-first")).rejects.toThrow("Throughput exceeds");
    expect(ruleData).toHaveBeenCalledTimes(5);
    expect(ruleDataBasic).not.toHaveBeenCalled();
  });

  it("throws at once for an error that a retry cannot fix", async () => {
    ruleData.mockRejectedValue(graphqlError('Cannot query field "createdByEmail" on type "Rule".'));

    await expect(getRuleData("fix-bugs-first")).rejects.toThrow("createdByEmail");
    expect(ruleData).toHaveBeenCalledTimes(1);
  });

  it("returns the rule without related rules when a related rule is missing", async () => {
    ruleData.mockRejectedValue(notFound("public/uploads/rules/deleted-rule/rule.mdx"));
    ruleDataBasic.mockResolvedValue(ruleResult({}));

    const result = await getRuleData("fix-bugs-first");

    expect(result?.data.rule.related).toEqual([]);
    expect(result?.brokenReferences).toEqual({ detected: true, paths: ["public/uploads/rules/deleted-rule/rule.mdx"] });
  });

  it("returns null when the rule does not exist", async () => {
    ruleData.mockRejectedValue(notFound("public/uploads/rules/no-such-rule/rule.mdx"));
    ruleDataBasic.mockRejectedValue(notFound("public/uploads/rules/no-such-rule/rule.mdx"));

    await expect(getRuleData("no-such-rule")).resolves.toBeNull();
  });

  it("throws when ruleDataBasic is throttled after a missing related rule", async () => {
    ruleData.mockRejectedValue(notFound("public/uploads/rules/deleted-rule/rule.mdx"));
    ruleDataBasic.mockRejectedValue(throttled());

    await expect(getRuleData("fix-bugs-first")).rejects.toThrow("Throughput exceeds");
  });
});

describe("getCategoryData", () => {
  it("returns null without a category request when no top category lists the filename", async () => {
    topCategoryWithIndexQuery.mockResolvedValue(topCategories("rules-to-better-email"));

    await expect(getCategoryData("fix-bugs-first")).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("throws when the top category lookup stays throttled, so a category page cannot become a fallback", async () => {
    topCategoryWithIndexQuery.mockRejectedValue(throttled());

    await expect(getCategoryData("rules-to-better-email")).rejects.toThrow("Throughput exceeds");
    expect(topCategoryWithIndexQuery).toHaveBeenCalledTimes(5);
  });

  // Behaves like TinaClient.request: with the default "throw" policy a response with errors throws
  const tinaRequest = (...responses: { data: unknown; errors: { message: string }[] | null }[]) => {
    let call = 0;
    request.mockImplementation(async ({ errorPolicy }: { errorPolicy?: string }) => {
      const response = responses[Math.min(call++, responses.length - 1)];
      if (response.errors && errorPolicy !== "all") throw graphqlError(response.errors.map((e) => e.message).join("\n"));
      return response;
    });
  };
  const email = { category: { title: "Rules to Better Email" } };
  const missingRule = { message: "Unable to find record public/uploads/rules/gone/rule.mdx" };

  it("sends one request with the default error policy for a complete category", async () => {
    topCategoryWithIndexQuery.mockResolvedValue(topCategories("rules-to-better-email"));
    tinaRequest({ data: email, errors: null });

    const result = await getCategoryData("rules-to-better-email");

    expect(result?.data.category.title).toBe("Rules to Better Email");
    expect(result?.variables).toEqual({ relativePath: "software-engineering/rules-to-better-email.mdx" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0].errorPolicy).toBeUndefined();
  });

  it("retries a throttled category request", async () => {
    topCategoryWithIndexQuery.mockResolvedValue(topCategories("rules-to-better-email"));
    tinaRequest({ data: null, errors: [{ message: THROTTLED }] }, { data: email, errors: null });

    const result = await getCategoryData("rules-to-better-email");

    expect(result?.data.category.title).toBe("Rules to Better Email");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("keeps the category when only some of its rules are missing", async () => {
    topCategoryWithIndexQuery.mockResolvedValue(topCategories("rules-to-better-email"));
    tinaRequest({ data: email, errors: [missingRule] });

    const result = await getCategoryData("rules-to-better-email");

    expect(result?.data.category.title).toBe("Rules to Better Email");
    expect(result?.query).toBe("query categoryWithRulesQuery");
    expect(request.mock.calls.map(([args]) => args.errorPolicy)).toEqual([undefined, "all"]);
  });

  it("changes the request body for each partial attempt, so the build cache cannot return a throttled response", async () => {
    topCategoryWithIndexQuery.mockResolvedValue(topCategories("rules-to-better-email"));
    tinaRequest(
      { data: email, errors: [missingRule] },
      { data: { category: { title: "Partial" } }, errors: [missingRule, { message: THROTTLED }] },
      { data: email, errors: [missingRule] }
    );

    const result = await getCategoryData("rules-to-better-email");

    expect(result?.data.category.title).toBe("Rules to Better Email");
    const [, firstPartial, secondPartial] = request.mock.calls.map(([args]) => args.query);
    expect(firstPartial).not.toBe(secondPartial);
  });

  it("returns null when the category file itself is missing", async () => {
    topCategoryWithIndexQuery.mockResolvedValue(topCategories("rules-to-better-email"));
    tinaRequest({ data: { category: null }, errors: [{ message: "Unable to find record categories/software-engineering/rules-to-better-email.mdx" }] });

    await expect(getCategoryData("rules-to-better-email")).resolves.toBeNull();
  });

  it("throws at once for a fatal error", async () => {
    topCategoryWithIndexQuery.mockResolvedValue(topCategories("rules-to-better-email"));
    tinaRequest({ data: email, errors: [{ message: "Internal resolver error" }] });

    await expect(getCategoryData("rules-to-better-email")).rejects.toThrow("Internal resolver error");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("throws for a fatal error in the partial response", async () => {
    topCategoryWithIndexQuery.mockResolvedValue(topCategories("rules-to-better-email"));
    tinaRequest({ data: email, errors: [missingRule] }, { data: email, errors: [missingRule, { message: "Internal resolver error" }] });

    await expect(getCategoryData("rules-to-better-email")).rejects.toThrow("Internal resolver error");
  });
});
