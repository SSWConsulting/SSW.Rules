import { isExternalSSWSite, isExternalLink } from "@/lib/linkUtils";

describe("isExternalSSWSite", () => {
  it("handles handles main site links", () => {
    expect(isExternalSSWSite("https://www.ssw.com.au/")).toBe(true);
    expect(isExternalSSWSite("https://ssw.com.au/")).toBe(true);
    expect(isExternalSSWSite("https://ssw.com.au")).toBe(true);
    expect(isExternalSSWSite("https://www.ssw.com.au")).toBe(true);
  });
});

describe("isExternalLink", () => {
  it("handles external links", () => {
    expect(isExternalLink("https://www.google.com")).toBe(true);
    expect(isExternalLink("https://ssw.com.au")).toBe(true);
    expect(isExternalLink("https://www.ssw.com.au/rules")).toBe(false);
    expect(isExternalLink("/internal-link")).toBe(false);
  });
});