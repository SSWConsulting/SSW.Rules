import { numberSources, parseCitedRules, referencedUris } from "@/lib/rulesChat/numbering";

const found = (uri: string) => ({ uri, title: uri, excerpts: [] });
const cited = [
  { number: 1, uri: "reply-done" },
  { number: 2, uri: "branch-naming" },
];

describe("numberSources", () => {
  it("numbers from 1 in a new conversation", () => {
    expect(numberSources([found("a"), found("b")], []).map((source) => source.number)).toEqual([1, 2]);
  });

  it("reuses the number of a rule cited earlier and continues after the highest", () => {
    expect(numberSources([found("x"), found("branch-naming"), found("y")], cited).map((source) => source.number)).toEqual([3, 2, 4]);
  });
});

describe("referencedUris", () => {
  it("finds the rules behind the numbers a question mentions", () => {
    expect(referencedUris("Tell me more about [2]", cited)).toEqual(["branch-naming"]);
    expect(referencedUris("Compare [1] and [2] and [9]", cited)).toEqual(["reply-done", "branch-naming"]);
    expect(referencedUris("What about emails?", cited)).toEqual([]);
  });
});

describe("parseCitedRules", () => {
  it("accepts a missing list and a well-formed one", () => {
    expect(parseCitedRules(undefined)).toEqual([]);
    expect(parseCitedRules(cited)).toEqual(cited);
  });

  it.each([
    ["not a list", "x"],
    ["a non-integer number", [{ number: 1.5, uri: "a" }]],
    ["a number below 1", [{ number: 0, uri: "a" }]],
    ["a uri with a path", [{ number: 1, uri: "../a" }]],
    ["a missing uri", [{ number: 1 }]],
    ["too many entries", Array.from({ length: 101 }, (_, index) => ({ number: index + 1, uri: "a" }))],
  ])("rejects %s", (_name, value) => {
    expect(parseCitedRules(value)).toBeNull();
  });
});
