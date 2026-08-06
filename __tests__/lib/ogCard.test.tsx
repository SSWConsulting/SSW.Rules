/**
 * @jest-environment node
 */
import { buildOgCard } from "@/lib/og/card";

jest.mock("@/lib/og/images", () => ({
  loadPolygon: jest.fn(async () => "data:image/png;base64,POLYGON"),
  loadAvatar: jest.fn(async (author: { url?: string }) => `data:image/jpeg;base64,${author.url}`),
}));

/** Flattens the element tree to the text nodes Satori would draw. */
const texts = (node: any): string[] => {
  if (node == null || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(texts);
  return texts(node.props?.children);
};

const find = (node: any, predicate: (n: any) => boolean): any[] => {
  if (node == null || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((n) => find(n, predicate));
  const self = predicate(node) ? [node] : [];
  return [...self, ...find(node.props?.children, predicate)];
};

// Avatar and ExtraChip are component elements, so their output is not in the tree -
// assert on the props they were handed instead.
const componentsNamed = (node: any, name: string) => find(node, (n) => typeof n.type === "function" && n.type.name === name);

const author = (title: string) => ({ title, url: `https://www.ssw.com.au/people/${title.toLowerCase().replace(/ /g, "-")}` });

describe("buildOgCard", () => {
  it("summarises contributors rather than listing names", async () => {
    const card = await buildOgCard({ title: "A rule", authors: [author("Adam Cogan"), author("Igor Goldobin"), author("Kosta Madorsky")] });
    expect(texts(card)).toContain("3 contributors");
    expect(texts(card)).not.toContain("Adam Cogan");
  });

  it("singularises a lone contributor", async () => {
    const card = await buildOgCard({ title: "A rule", authors: [author("Adam Cogan")] });
    expect(texts(card)).toContain("1 contributor");
  });

  it("caps faces at two and puts the remainder in a chip", async () => {
    const card = await buildOgCard({ title: "A rule", authors: [author("A B"), author("C D"), author("E F"), author("G H")] });
    expect(componentsNamed(card, "Avatar")).toHaveLength(2);
    expect(componentsNamed(card, "ExtraChip")[0]?.props.count).toBe(2);
    expect(texts(card)).toContain("4 contributors");
  });

  // Regression: `extra && <div/>` rendered a literal "0" on single-author cards
  it("renders no chip when every contributor has a face", async () => {
    const card = await buildOgCard({ title: "A rule", authors: [author("A B"), author("C D")] });
    expect(componentsNamed(card, "ExtraChip")).toHaveLength(0);
    expect(texts(card)).toContain("2 contributors");
  });

  it("leaves the byline empty rather than falling back to the site URL", async () => {
    const card = await buildOgCard({ title: "A category", authors: [] });
    expect(texts(card)).not.toContain("0 contributors");
    expect(componentsNamed(card, "Avatar")).toHaveLength(0);
  });

  it("always shows the site URL, and the rule total only when given", async () => {
    expect(texts(await buildOgCard({ title: "x", totalRules: 3802 }))).toEqual(expect.arrayContaining(["3,802 rules", "ssw.com.au/rules"]));
    expect(texts(await buildOgCard({ title: "x" }))).toContain("ssw.com.au/rules");
    expect(texts(await buildOgCard({ title: "x" })).join(" ")).not.toContain("rules |");
  });

  it("gives hub pages a larger title than rules", async () => {
    const titleSize = async (isHub: boolean) => {
      const card = await buildOgCard({ title: "T", isHub });
      return find(card, (n) => n.props?.style?.lineClamp === 3)[0]?.props?.style?.fontSize;
    };
    expect(await titleSize(true)).toBeGreaterThan(await titleSize(false));
  });
});
