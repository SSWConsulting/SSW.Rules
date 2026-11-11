import type { SearchResult } from "algoliasearch";
import { mergeStemmedResults, withStemmedQueries } from "@/lib/search/stemmedSearch";

const request = (query: string, extra: Record<string, unknown> = {}) => ({ indexName: "rules", params: { query, hitsPerPage: 8, ...extra } });

const result = (ids: string[], extra: Record<string, unknown> = {}) =>
  ({ hits: ids.map((objectID) => ({ objectID })), nbHits: ids.length, hitsPerPage: 8, page: 0, query: "", ...extra }) as unknown as SearchResult;

const hitIds = (result: SearchResult | undefined) => (result && "hits" in result ? result.hits.map((hit) => hit.objectID) : undefined);

describe("withStemmedQueries", () => {
  it.each(["squashing", "squashed", "squashes"])("appends a prefix-matching stemmed copy of %s", (query) => {
    const { requests, stemmedIndexes } = withStemmedQueries([request(query)]);

    expect(requests).toEqual([request(query), request("squash", { queryType: "prefixAll" })]);
    expect(stemmedIndexes).toEqual([1]);
  });

  it("stems each plain word and leaves other tokens alone", () => {
    const { requests } = withStemmedQueries([request("Squashing .NET commits c#")]);

    expect(requests[1].params?.query).toBe("squash .net commit c#");
  });

  it("adds no copy when stemming changes nothing, so typos are searched once as typed", () => {
    expect(withStemmedQueries([request("squash")]).stemmedIndexes).toEqual([undefined]);
    expect(withStemmedQueries([request("sqush")]).stemmedIndexes).toEqual([undefined]);
    expect(withStemmedQueries([request("  Squash   test ")]).requests).toHaveLength(1);
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
  it("puts the typed query's hits first and adds only new hits from the stemmed query", () => {
    const [merged] = mergeStemmedResults([result(["exact", "both"]), result(["both", "stemmed"])], [1]);

    expect(hitIds(merged)).toEqual(["exact", "both", "stemmed"]);
    expect(merged).toMatchObject({ nbHits: 3 });
  });

  it("returns the stemmed query's hits when the typed query finds none", () => {
    const [merged] = mergeStemmedResults([result([]), result(["a", "b"])], [1]);

    expect(hitIds(merged)).toEqual(["a", "b"]);
    expect(merged).toMatchObject({ nbHits: 2 });
  });

  it("caps the merged hits at the page size", () => {
    const [merged] = mergeStemmedResults([result(["a", "b"], { hitsPerPage: 3 }), result(["c", "d"])], [1]);

    expect(hitIds(merged)).toEqual(["a", "b", "c"]);
  });

  it("drops the stemmed results and leaves requests without a copy untouched", () => {
    const plain = result(["x"]);
    const merged = mergeStemmedResults([result(["a"]), plain, result(["b"])], [2, undefined]);

    expect(merged).toHaveLength(2);
    expect(merged[1]).toBe(plain);
  });
});
