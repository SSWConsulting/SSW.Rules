import { hasAssignedCategory } from "@/lib/services/rules/orphaned-rules";

describe("hasAssignedCategory", () => {
  it("returns false when a rule has no categories", () => {
    expect(hasAssignedCategory(null)).toBe(false);
    expect(hasAssignedCategory([])).toBe(false);
  });

  it("returns false when category entries are empty", () => {
    expect(
      hasAssignedCategory([
        null,
        {},
        {
          category: {
            title: "   ",
            uri: "",
          },
        },
      ])
    ).toBe(false);
  });

  it("returns true when a rule has a category title", () => {
    expect(
      hasAssignedCategory([
        {
          category: {
            title: "AI Development",
          },
        },
      ])
    ).toBe(true);
  });

  it("returns true when a rule has a category uri", () => {
    expect(
      hasAssignedCategory([
        {
          category: {
            uri: "/rules/applications-and-size",
          },
        },
      ])
    ).toBe(true);
  });
});
