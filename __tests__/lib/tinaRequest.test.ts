/**
 * @jest-environment node
 */
import { classifyTinaError, isRecordNotFound, withTinaRetry } from "@/lib/tina/tinaRequest";

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
