import { readCategoryReturnStates, requestScrollRestore, saveCategoryReturnState, takeScrollRestore } from "@/lib/categoryReturnState";

describe("categoryReturnState", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("saves the list position per category", () => {
    saveCategoryReturnState("rules-to-better-ai", "?page=2", 1500);

    expect(readCategoryReturnStates()["rules-to-better-ai"]).toEqual({ search: "?page=2", scrollY: 1500, restoreRequestedAt: null });
  });

  it("restores scroll only after a request, and only once", () => {
    saveCategoryReturnState("rules-to-better-ai", "?page=2", 1500);
    expect(takeScrollRestore("rules-to-better-ai", "?page=2")).toBeNull();

    requestScrollRestore("rules-to-better-ai");
    expect(takeScrollRestore("rules-to-better-ai", "?page=2")).toBe(1500);
    expect(takeScrollRestore("rules-to-better-ai", "?page=2")).toBeNull();
  });

  it("does not restore scroll when the list query changed", () => {
    saveCategoryReturnState("rules-to-better-ai", "?page=2", 1500);
    requestScrollRestore("rules-to-better-ai");

    expect(takeScrollRestore("rules-to-better-ai", "?page=3")).toBeNull();
  });

  it("ignores a restore request that was never used", () => {
    jest.useFakeTimers();
    saveCategoryReturnState("rules-to-better-ai", "?page=2", 1500);
    requestScrollRestore("rules-to-better-ai");
    jest.advanceTimersByTime(60_000);

    expect(takeScrollRestore("rules-to-better-ai", "?page=2")).toBeNull();
    jest.useRealTimers();
  });

  it("ignores corrupt storage", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    window.sessionStorage.setItem("ssw-rules:category-return", "{not json");

    expect(readCategoryReturnStates()).toEqual({});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
