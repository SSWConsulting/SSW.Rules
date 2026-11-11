import { isCitedRuleLink, linkCitations, numberCitations } from "@/components/chat/citations";

describe("isCitedRuleLink", () => {
  const sources = [
    { number: 1, title: "Rule a", href: "/rule-a" },
    { number: 2, title: "Rule b", href: "/rule-b" },
  ];

  it("allows links to the rules the answer cites", () => {
    expect(isCitedRuleLink("/rule-a", sources)).toBe(true);
  });

  it.each([["/api/auth/logout"], ["/\\evil.example"], ["//evil.example"], ["https://evil.example"], ["/rule-c"], [undefined]])("refuses %s", (href) => {
    expect(isCitedRuleLink(href, sources)).toBe(false);
  });

  it("refuses every link when the answer cites nothing", () => {
    expect(isCitedRuleLink("/rule-a")).toBe(false);
  });
});

const rule = (number: number, name: number | string = number) => ({ number, title: `Rule ${name}`, href: `/rule-${name}` });
const retrieved = [1, 2, 3, 4, 5, 6, 7, 8].map((number) => rule(number));

describe("numberCitations", () => {
  it("numbers the cited rules 1, 2, 3 in the order the first answer mentions them", () => {
    const result = numberCitations("Use gitmoji [7]. Agree on a set [1]. See also [7][3].", retrieved, []);
    expect(result.text).toBe("Use gitmoji [1]. Agree on a set [2]. See also [1][3].");
    expect(result.sources).toEqual([rule(1, 7), rule(2, 1), rule(3, 3)]);
  });

  it("keeps the number of a rule cited earlier and continues the sequence for new rules", () => {
    const known = [rule(1, "a"), rule(2, "b")];
    // The server shows known rules under their own number and new rules under provisional ones.
    const shown = [rule(2, "b"), rule(3, "c"), rule(4, "d"), rule(5, "e")];
    const result = numberCitations("New [5], old [2], new [3].", shown, known);
    expect(result.text).toBe("New [3], old [2], new [4].");
    expect(result.sources).toEqual([rule(3, "e"), rule(2, "b"), rule(4, "c")]);
  });

  it("keeps a citation to an earlier rule that was not searched for again", () => {
    const result = numberCitations("As in [1].", [rule(2, "b")], [rule(1, "a")]);
    expect(result.text).toBe("As in [1].");
    expect(result.sources).toEqual([rule(1, "a")]);
  });

  it("drops citations to numbers that belong to no rule", () => {
    const result = numberCitations("Made up [12], real [2].", retrieved, []);
    expect(result.text).toBe("Made up, real [1].");
    expect(result.sources).toEqual([rule(1, 2)]);
  });

  it("keeps the numbering stable as more of the answer streams in", () => {
    const partial = numberCitations("First [5]. Second [2", retrieved, []);
    const complete = numberCitations("First [5]. Second [2].", retrieved, []);
    expect(partial.sources.map((source) => source.title)).toEqual(["Rule 5"]);
    expect(complete.sources.map((source) => source.title)).toEqual(["Rule 5", "Rule 2"]);
  });

  it("leaves square brackets inside code alone", () => {
    const answer = "Use `items[1]` [2].\n\n```js\nconst first = args[0];\n```";
    const result = numberCitations(answer, retrieved, []);
    expect(result.text).toBe("Use `items[1]` [1].\n\n```js\nconst first = args[0];\n```");
    expect(result.sources.map((source) => source.title)).toEqual(["Rule 2"]);
  });
});

describe("linkCitations", () => {
  it("links known citations and leaves unknown numbers and code as they are", () => {
    expect(linkCitations("See [1] and [4], not `a[1]`.", [rule(1, 7)])).toBe("See [[1]](/rule-7) and [4], not `a[1]`.");
  });
});
