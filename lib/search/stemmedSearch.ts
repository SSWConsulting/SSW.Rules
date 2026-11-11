import type { Hit, LegacySearchMethodProps, SearchResult } from "algoliasearch";
import { stem } from "porter2";

type SearchRequest = LegacySearchMethodProps[number];

const PLAIN_WORD = /^[a-z]+$/;

/** Expects a query that is already trimmed, lowercased and single-spaced. */
function stemQuery(query: string): string {
  return query
    .split(" ")
    .map((word) => (PLAIN_WORD.test(word) ? stem(word) : word))
    .join(" ");
}

/**
 * Appends a stemmed copy of each request whose query changes when stemmed, and asks for ranking info on the typed
 * request so the merge can tell exact hits from typo hits. `stemmedIndexes[i]` is the position of request i's stemmed
 * copy, or undefined when it has none.
 */
export function withStemmedQueries(requests: SearchRequest[]): { requests: SearchRequest[]; stemmedIndexes: (number | undefined)[] } {
  const all = [...requests];
  const stemmedIndexes = requests.map((request, i) => {
    const query = request.params?.query?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
    // Page 2 of the merged list can't be built from page 2 of each list, so only the first page gets a stemmed copy.
    if (!query || (request.params?.page ?? 0) > 0) return undefined;

    const stemmed = stemQuery(query);
    if (stemmed === query) return undefined;

    all[i] = { ...request, params: { ...request.params, getRankingInfo: true } };
    // A stem is often not a whole word ("migrations" becomes "migrat"), so every word must match as a prefix. The typed
    // query already finds typos, and typos on top of prefixes match far too much.
    all.push({ ...request, params: { ...request.params, query: stemmed, queryType: "prefixAll", typoTolerance: false } });
    return all.length - 1;
  });
  return { requests: all, stemmedIndexes };
}

function withoutRankingInfo(hit: Hit): Hit {
  const { _rankingInfo, ...rest } = hit;
  return rest as Hit;
}

/**
 * Returns one result per original request. Where a request has a stemmed copy, the page holds the typed query's exact
 * hits, then the stemmed query's new hits, then the typed query's typo hits. The counts describe that single page.
 */
export function mergeStemmedResults(results: SearchResult[], stemmedIndexes: (number | undefined)[]): SearchResult[] {
  return stemmedIndexes.map((stemmedIndex, i) => {
    const result = results[i];
    const stemmed = stemmedIndex === undefined ? undefined : results[stemmedIndex];
    if (!("hits" in result) || !stemmed || !("hits" in stemmed)) return result;

    const exact = result.hits.filter((hit) => hit._rankingInfo?.nbTypos === 0);
    const typos = result.hits.filter((hit) => hit._rankingInfo?.nbTypos !== 0);
    const seen = new Set<string>();
    const hits = [...exact, ...stemmed.hits, ...typos]
      .filter((hit) => !seen.has(hit.objectID) && seen.add(hit.objectID))
      .slice(0, result.hitsPerPage ?? Number.POSITIVE_INFINITY)
      .map(withoutRankingInfo);

    return {
      ...result,
      hits,
      nbHits: hits.length,
      nbPages: hits.length > 0 ? 1 : 0,
      exhaustiveNbHits: false,
      exhaustive: { ...result.exhaustive, nbHits: false },
    };
  });
}
