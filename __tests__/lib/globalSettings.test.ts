/**
 * @jest-environment node
 */
import { unstable_cache } from "next/cache";
import { GLOBAL_SETTINGS_TAG, getGlobalSettings } from "@/lib/services/global";
import client from "@/tina/__generated__/client";

jest.mock("next/cache", () => ({ unstable_cache: jest.fn((fn: unknown) => fn) }));
jest.mock("@/tina/__generated__/client", () => ({ __esModule: true, default: { queries: { global: jest.fn() } } }));

const globalQuery = (client as any).queries.global as jest.Mock;
// The module calls unstable_cache one time, when it loads
const [, , cacheOptions] = (unstable_cache as jest.Mock).mock.calls[0];

beforeEach(() => globalQuery.mockReset());

describe("getGlobalSettings", () => {
  // The root layout calls it, so a number here makes Next.js render each page of the site again after that time
  it("gives the pages no revalidation period", () => {
    expect(cacheOptions.revalidate).toBeUndefined();
  });

  it("puts the global settings tag on the pages", () => {
    expect(cacheOptions.tags).toEqual([GLOBAL_SETTINGS_TAG]);
  });

  it("returns the global settings document", async () => {
    const settings = { theme: { color: "blue" } };
    globalQuery.mockResolvedValue({ data: { global: settings } });

    await expect(getGlobalSettings()).resolves.toEqual(settings);
    expect(globalQuery).toHaveBeenCalledWith({ relativePath: "index.json" }, {});
  });

  // unstable_cache stores only a result. An error must stay an error, or the cache keeps a page without settings.
  it("tries a throttled request again, then rejects", async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    globalQuery.mockRejectedValue(new Error("Throughput exceeds the current capacity of your table or index"));

    try {
      const result = expect(getGlobalSettings()).rejects.toThrow("Throughput exceeds");
      await jest.runAllTimersAsync();
      await result;
      expect(globalQuery).toHaveBeenCalledTimes(5);
    } finally {
      warn.mockRestore();
      jest.useRealTimers();
    }
  });
});
