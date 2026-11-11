import type { SearchResult } from "algoliasearch";
import { mergeStemmedResults, withStemmedQueries } from "@/lib/search/stemmedSearch";

const request = (query: string, extra: Record<string, unknown> = {}) => ({ indexName: "rules", params: { query, hitsPerPage: 8, ...extra } });

type TestHit = { objectID: string; _rankingInfo?: { nbTypos: number } };

const exact = (objectID: string): TestHit => ({ objectID, _rankingInfo: { nbTypos: 0 } });
const typo = (objectID: string): TestHit => ({ objectID, _rankingInfo: { nbTypos: 2 } });
const plainHit = (objectID: string): TestHit => ({ objectID });

const result = (hits: TestHit[], extra: Record<string, unknown> = {}) =>
  ({ hits, nbHits: hits.length, nbPages: 1, hitsPerPage: 8, page: 0, query: "", exhaustive: { nbHits: true }, ...extra }) as unknown as SearchResult;

const hitIds = (result: SearchResult | undefined) => (result && "hits" in result ? result.hits.map((hit) => hit.objectID) : undefined);

describe("withStemmedQueries", () => {
  it.each(["squashing", "squashed", "squashes"])("appends a prefix-matching stemmed copy of %s", (query) => {
    const { requests, stemmedIndexes } = withStemmedQueries([request(query)]);

    expect(requests).toEqual([request(query, { getRankingInfo: true }), request("squash", { queryType: "prefixAll", typoTolerance: false })]);
    expect(stemmedIndexes).toEqual([1]);
  });

  it("stems each plain word and leaves other tokens alone", () => {
    const { requests } = withStemmedQueries([request("Squashing .NET commits c#")]);

    expect(requests[1].params?.query).toBe("squash .net commit c#");
  });

  it("stems to real word forms where Porter2 can", () => {
    const { requests } = withStemmedQueries([request("deploying using")]);

    expect(requests[1].params?.query).toBe("deploy use");
  });

  it("adds no copy when stemming changes nothing, so typos are searched once as typed", () => {
    expect(withStemmedQueries([request("squash")]).stemmedIndexes).toEqual([undefined]);
    expect(withStemmedQueries([request("sqush")]).stemmedIndexes).toEqual([undefined]);
    expect(withStemmedQueries([request("  Squash   test ")]).requests).toEqual([request("  Squash   test ")]);
  });

  it("adds no copy for empty queries or later pages", () => {
    const { requests, stemmedIndexes } = withStemmedQueries([request(""), request("squashing", { page: 1 })]);

    expect(requests).toHaveLength(2);
    expect(stemmedIndexes).toEqual([undefined, undefined]);
  });

  it("keeps track of each copy when there are several requests", () => {
    const { requests, stemmedIndexes } = withStemmedQueries([request("squashing"), request("squash"), request("commits")]);

    expect(requests.map((r) => r.params?.query)).toEqual(["squashing", "squash", "commits", "squash", "commit"]);
    expect(stemmedIndexes).toEqual([3, undefined, 4]);
  });
});

describe("mergeStemmedResults", () => {
  it("puts the typed query's exact hits first, then new stemmed hits, then the typed query's typo hits", () => {
    const [merged] = mergeStemmedResults([result([exact("a"), typo("b"), exact("c")]), result([plainHit("c"), plainHit("d"), plainHit("b")])], [1]);

    expect(hitIds(merged)).toEqual(["a", "c", "d", "b"]);
  });

  it("shows stemmed hits even when the typed query fills the page with typo hits", () => {
    const typed = result(["t1", "t2", "t3", "t4"].map(typo), { hitsPerPage: 4, nbHits: 33 });
    const [merged] = mergeStemmedResults([typed, result([plainHit("s1"), plainHit("s2")])], [1]);

    expect(hitIds(merged)).toEqual(["s1", "s2", "t1", "t2"]);
  });

  it("returns the stemmed query's hits when the typed query finds none", () => {
    const [merged] = mergeStemmedResults([result([]), result([plainHit("a"), plainHit("b")])], [1]);

    expect(hitIds(merged)).toEqual(["a", "b"]);
  });

  it("caps the merged hits at the page size and makes the counts describe that page", () => {
    const typed = result([exact("a"), exact("b")], { hitsPerPage: 3, nbHits: 2, nbPages: 0 });
    const [merged] = mergeStemmedResults([typed, result([plainHit("c"), plainHit("d")], { nbHits: 40 })], [1]);

    expect(hitIds(merged)).toEqual(["a", "b", "c"]);
    expect(merged).toMatchObject({ nbHits: 3, nbPages: 1, exhaustiveNbHits: false, exhaustive: { nbHits: false } });
  });

  it("removes the ranking info it asked for", () => {
    const [merged] = mergeStemmedResults([result([exact("a"), typo("b")]), result([])], [1]);

    expect(merged && "hits" in merged && merged.hits.some((hit) => "_rankingInfo" in hit)).toBe(false);
  });

  it("drops the stemmed results and leaves requests without a copy untouched", () => {
    const plain = result([plainHit("x")]);
    const merged = mergeStemmedResults([result([exact("a")]), plain, result([plainHit("b")])], [2, undefined]);

    expect(merged).toHaveLength(2);
    expect(merged[1]).toBe(plain);
  });
});
