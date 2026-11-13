/**
 * @jest-environment node
 */
import {
  classifyTinaError,
  isRecordNotFound,
  tinaResponseErrorMessages,
  tinaRetryOptions,
  withTinaRetry,
  withTinaRetryAllowingErrors,
} from "@/lib/tina/tinaRequest";

// Error texts as the Tina client throws them (copied from production build logs)
const graphqlError = (message: string) =>
  new Error(`Unable to fetch, please see our FAQ for more information: https://tina.io/docs/r/FAQ/\n      Errors: \n\t${message}`);
const throttled = () =>
  graphqlError(
    "Error retrieving data from DynamoDB: Throughput exceeds the current capacity of your table or index. DynamoDB is automatically scaling your table or index so please try again shortly."
  );
const notFound = (path = "public/uploads/rules/missing-rule/rule.mdx") => graphqlError(`Unable to find record ${path}`);
const httpError = (status: number, text: string) =>
  new Error(`Server responded with status code ${status}, ${text}.  Please see our FAQ for more information: https://tina.io/docs/r/FAQ/`);

describe("classifyTinaError", () => {
  it.each([
    ["a missing record", notFound(), "not-found"],
    ["DynamoDB throttling", throttled(), "transient"],
    [
      "throttling next to a missing record",
      graphqlError("Unable to find record a/rule.mdx\nError retrieving data from DynamoDB: Throughput exceeds the current capacity"),
      "transient",
    ],
    ["a 500 response", httpError(500, "Internal Server Error"), "transient"],
    ["a 503 response", httpError(503, "Service Unavailable"), "transient"],
    ["a 429 response", httpError(429, "Too Many Requests"), "transient"],
    ["a 401 response", httpError(401, "Unauthorized"), "fatal"],
    ["a field the schema does not have", graphqlError('Cannot query field "createdByEmail" on type "Rule".'), "fatal"],
    [
      "a network failure",
      Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) }),
      "transient",
    ],
    ["a message string", "Error retrieving data from DynamoDB: Throughput exceeds the current capacity", "transient"],
  ])("classifies %s", (_name, error, kind) => {
    expect(classifyTinaError(error)).toBe(kind);
  });

  it("does not report a throttled request as a missing record", () => {
    expect(isRecordNotFound(throttled())).toBe(false);
    expect(isRecordNotFound(notFound())).toBe(true);
  });
});

describe("withTinaRetry", () => {
  const sleep = jest.fn((_ms: number) => Promise.resolve());

  beforeEach(() => {
    sleep.mockClear();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("retries a transient error with a growing delay, then returns the result", async () => {
    const request = jest.fn().mockRejectedValueOnce(throttled()).mockRejectedValueOnce(httpError(503, "Service Unavailable")).mockResolvedValue("data");

    await expect(withTinaRetry("ruleData x", request, { sleep, baseDelayMs: 1000 })).resolves.toBe("data");

    expect(request).toHaveBeenCalledTimes(3);
    const [first, second] = sleep.mock.calls.map(([ms]) => ms);
    expect(first).toBeGreaterThanOrEqual(750);
    expect(first).toBeLessThanOrEqual(1250);
    expect(second).toBeGreaterThanOrEqual(1500);
    expect(second).toBeLessThanOrEqual(2500);
  });

  it("throws the last transient error after the last attempt", async () => {
    const request = jest.fn().mockRejectedValue(throttled());

    await expect(withTinaRetry("ruleData x", request, { sleep, attempts: 3 })).rejects.toThrow("Throughput exceeds");
    expect(request).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a missing record", notFound()],
    ["a fatal error", graphqlError('Cannot query field "createdByEmail" on type "Rule".')],
  ])("does not retry %s", async (_name, error) => {
    const request = jest.fn().mockRejectedValue(error);

    await expect(withTinaRetry("ruleData x", request, { sleep })).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe("tinaRetryOptions", () => {
  const revalidate60 = { fetchOptions: { next: { revalidate: 60 } } };

  it("sends the first attempt unchanged, so it can use the data cache", () => {
    expect(tinaRetryOptions(1)).toEqual({});
    expect(tinaRetryOptions(1, revalidate60)).toBe(revalidate60);
  });

  const retryHeader = (options: ReturnType<typeof tinaRetryOptions>) => (options.fetchOptions?.headers as Record<string, string>)["x-tina-retry"];

  it("adds a retry header to each later attempt, so Next uses a new data cache key", () => {
    expect(retryHeader(tinaRetryOptions(2))).toMatch(/^2-[a-z0-9]+$/);
    const third = tinaRetryOptions(3, revalidate60);
    expect(third.fetchOptions?.next).toEqual({ revalidate: 60 });
    expect(retryHeader(third)).toMatch(/^3-[a-z0-9]+$/);
  });

  it("uses a new header value for each call, so a retry cannot read a response that another page's retry stored", () => {
    expect(retryHeader(tinaRetryOptions(2))).not.toBe(retryHeader(tinaRetryOptions(2)));
  });

  it("keeps the headers that the caller sets", () => {
    const options = { fetchOptions: { headers: { "x-branch": "main" } } };

    expect(tinaRetryOptions(2, options).fetchOptions?.headers).toEqual({ "x-branch": "main", "x-tina-retry": expect.stringMatching(/^2-/) });
    expect(options.fetchOptions.headers).toEqual({ "x-branch": "main" });
  });
});

describe("tinaResponseErrorMessages", () => {
  it("reads string and object errors and ignores empty ones", () => {
    expect(tinaResponseErrorMessages({ errors: [{ message: "a" }, "b", { message: "" }, null] })).toEqual(["a", "b"]);
    expect(tinaResponseErrorMessages({ errors: null })).toEqual([]);
    expect(tinaResponseErrorMessages(null)).toEqual([]);
  });
});

describe("withTinaRetryAllowingErrors", () => {
  const sleep = jest.fn((_ms: number) => Promise.resolve());
  const THROTTLED = "Error retrieving data from DynamoDB: Throughput exceeds the current capacity of your table or index.";
  const MISSING = "Unable to find record public/uploads/rules/gone/rule.mdx";

  beforeEach(() => {
    sleep.mockClear();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("returns a response whose only errors are missing records", async () => {
    const response = { data: { ok: true }, errors: [{ message: MISSING }] };
    const send = jest.fn().mockResolvedValue(response);

    await expect(withTinaRetryAllowingErrors("categoryRuleCountsQuery", "query q", send, { sleep })).resolves.toBe(response);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("marks every request, so the disk cache key differs from a default-policy request with the same query", async () => {
    const send = jest.fn().mockResolvedValue({ data: { ok: true }, errors: [{ message: MISSING }] });

    await withTinaRetryAllowingErrors("categoryRuleCountsQuery", "query q", send, { sleep });

    expect(send.mock.calls[0][0]).not.toBe("query q");
    expect(send.mock.calls[0][0]).toBe("query q\n# errorPolicy all");
  });

  it("retries a response with a throttling error and changes the query text for each retry", async () => {
    const good = { data: { ok: true }, errors: null };
    const send = jest
      .fn()
      .mockResolvedValueOnce({ data: null, errors: [{ message: THROTTLED }] })
      .mockResolvedValueOnce({ data: { partial: true }, errors: [{ message: MISSING }, { message: THROTTLED }] })
      .mockResolvedValue(good);

    await expect(withTinaRetryAllowingErrors("categoryRuleCountsQuery", "query q", send, { sleep })).resolves.toBe(good);
    const queries = send.mock.calls.map(([query]) => query);
    expect(queries[0]).toBe("query q\n# errorPolicy all");
    expect(queries[1]).toMatch(/^query q\n# errorPolicy all, retry 2-[a-z0-9]+$/);
    expect(queries[2]).toMatch(/^query q\n# errorPolicy all, retry 3-[a-z0-9]+$/);
  });

  it("throws after the last attempt when the throttling does not stop", async () => {
    const send = jest.fn().mockResolvedValue({ data: null, errors: [{ message: THROTTLED }] });

    await expect(withTinaRetryAllowingErrors("categoryRuleCountsQuery", "query q", send, { sleep, attempts: 3 })).rejects.toThrow("Throughput exceeds");
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("returns a response with a fatal error for the caller to handle", async () => {
    const response = { data: null, errors: [{ message: "Internal resolver error" }] };
    const send = jest.fn().mockResolvedValue(response);

    await expect(withTinaRetryAllowingErrors("categoryRuleCountsQuery", "query q", send, { sleep })).resolves.toBe(response);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("classifyTinaError with a requested path in the message", () => {
  it.each([
    "ECONNRESET",
    "ETIMEDOUT",
    "EPIPE",
    "UND_ERR_SOCKET",
    "ProvisionedThroughputExceeded",
    "EAI_AGAIN",
  ])("treats a missing record at /rules/%s as not-found, not transient", (slug) => {
    const error = notFound(`public/uploads/rules/${slug}/rule.mdx`);
    expect(classifyTinaError(error)).toBe("not-found");
  });

  it("still finds a real throttling error next to a missing record", () => {
    const error = graphqlError(
      "Unable to find record public/uploads/rules/ECONNRESET/rule.mdx\nError retrieving data from DynamoDB: Throughput exceeds the current capacity of your table or index."
    );
    expect(classifyTinaError(error)).toBe("transient");
  });

  it("treats Tina's invalid path error as not-found", () => {
    expect(classifyTinaError(graphqlError("Invalid path: relativePath contains invalid characters"))).toBe("not-found");
  });
});
