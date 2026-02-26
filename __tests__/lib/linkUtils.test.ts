import { isExternalSSWSite, isExternalLink } from "@/lib/linkUtils";
import { tree } from "next/dist/build/templates/app-page";

describe("isExternalSSWSite", () => {
  it("handles handles main site links", () => {
    expect(isExternalSSWSite("https://www.ssw.com.au/")).toBe(true);
    expect(isExternalSSWSite("https://ssw.com.au/")).toBe(true);
    expect(isExternalSSWSite("https://ssw.com.au")).toBe(true);
    expect(isExternalSSWSite("https://www.ssw.com.au")).toBe(true);
    expect(isExternalSSWSite("https://www.ssw.com.au/people")).toBe(true);
    expect(isExternalSSWSite("https://www.ssw.com.au/archive")).toBe(true);
    expect(isExternalSSWSite("https://www.ssw.com.au/rules")).toBe(false);
  });
});

describe("isExternalLink", () => {
  it("handles external links", () => {
    expect(isExternalLink("https://www.google.com")).toBe(true);
    expect(isExternalLink("https://ssw.com.au")).toBe(true);
    expect(isExternalLink("https://www.ssw.com.au/rules")).toBe(false);
    expect(isExternalLink("https://www.ssw.com.au/people")).toBe(true);
    expect(isExternalLink("/internal-link")).toBe(false);
  });
});