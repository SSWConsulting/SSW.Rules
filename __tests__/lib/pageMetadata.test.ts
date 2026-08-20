import { pageMetadata } from "@/lib/pageMetadata";
import { siteDescription, siteUrl } from "@/site-config";

describe("pageMetadata", () => {
  // Next's merge iterates the source's own keys and assigns `metadata[key] ?? null`,
  // so an explicit `description: undefined` NULLS the layout's rather than inheriting.
  it("always emits a description, never undefined", () => {
    const meta = pageMetadata({ title: "Search" });
    expect(meta.description).toBe(siteDescription);
    expect(meta.openGraph?.description).toBe(siteDescription);
    expect(meta.twitter?.description).toBe(siteDescription);
  });

  it("prefers a supplied description", () => {
    const meta = pageMetadata({ title: "A rule", description: "Specific." });
    expect(meta.description).toBe("Specific.");
    expect(meta.openGraph?.description).toBe("Specific.");
  });

  it("keeps og:title and twitter:title in step with the page title", () => {
    const meta = pageMetadata({ title: "Latest Rules | SSW.Rules", path: "latest-rules" });
    expect(meta.openGraph?.title).toBe("Latest Rules | SSW.Rules");
    expect(meta.twitter?.title).toBe("Latest Rules | SSW.Rules");
  });

  it("builds the canonical from the path, and the site root without one", () => {
    expect(pageMetadata({ title: "x", path: "archived" }).alternates?.canonical).toBe(`${siteUrl}/archived`);
    expect(pageMetadata({ title: "x" }).alternates?.canonical).toBe(`${siteUrl}/`);
  });

  // The opengraph-image routes supply the card; Next only merges it in when the
  // page's own openGraph has no `images` key.
  it("never sets openGraph.images", () => {
    expect(pageMetadata({ title: "x" }).openGraph).not.toHaveProperty("images");
  });

  it("only sets robots when asked", () => {
    expect(pageMetadata({ title: "x" })).not.toHaveProperty("robots");
    expect(pageMetadata({ title: "x", robots: { index: false } }).robots).toEqual({ index: false });
  });
});
