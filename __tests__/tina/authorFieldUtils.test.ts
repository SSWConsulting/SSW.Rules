import { DEFAULT_ADAM_AUTHOR, getDefaultAuthors, getMissingAuthorMessage, shouldDefaultToAdamCogan } from "@/tina/fields/authorFieldUtils";

describe("authorFieldUtils", () => {
  it("defaults to Adam Cogan when the rule was created by Adam", () => {
    expect(shouldDefaultToAdamCogan({ createdBy: "Adam Cogan" })).toBe(true);
    expect(getDefaultAuthors({ createdBy: "Adam Cogan" })).toEqual([DEFAULT_ADAM_AUTHOR]);
    expect(getMissingAuthorMessage({ createdBy: "Adam Cogan" })).toBeUndefined();
  });

  it("prompts editors to add an author when no default author applies", () => {
    expect(shouldDefaultToAdamCogan({ createdBy: "Tiago" })).toBe(false);
    expect(getDefaultAuthors({ createdBy: "Tiago" })).toBeUndefined();
    expect(getMissingAuthorMessage({ createdBy: "Tiago" })).toContain("non-SSW authors");
  });
});
