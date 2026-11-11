import type { LegacySearchMethodProps, SearchResult } from "algoliasearch";
import { stemmer } from "stemmer";

type SearchRequest = LegacySearchMethodProps[number];

const PLAIN_WORD = /^[a-z]+$/;

function stemQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (PLAIN_WORD.test(word) ? stemmer(word) : word))
    .join(" ");
}

/**
 * Appends a stemmed copy of each request whose query changes when stemmed. `stemmedIndexes[i]` is the position of
 * request i's stemmed copy, or undefined when it has none.
 */
export function withStemmedQueries(requests: SearchRequest[]): { requests: SearchRequest[]; stemmedIndexes: (number | undefined)[] } {
  const all = [...requests];
  const stemmedIndexes = requests.map((request) => {
    const query = request.params?.query?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
    // Page 2 of the merged list can't be built from page 2 of each list, so only the first page gets a stemmed copy.
    if (!query || (request.params?.page ?? 0) > 0) return undefined;

    const stemmed = stemQuery(query);
    if (stemmed === query) return undefined;

    // A stem is often not a whole word ("migrations" becomes "migrat"), so every word must match as a prefix.
    all.push({ ...request, params: { ...request.params, query: stemmed, queryType: "prefixAll" } });
    return all.length - 1;
  });
  return { requests: all, stemmedIndexes };
}

/**
 * Returns one result per original request. Where a request has a stemmed copy, its hits come first and the stemmed
 * query's new hits fill the rest of the page.
 */
export function mergeStemmedResults(results: SearchResult[], stemmedIndexes: (number | undefined)[]): SearchResult[] {
  return stemmedIndexes.map((stemmedIndex, i) => {
    const result = results[i];
    const stemmed = stemmedIndex === undefined ? undefined : results[stemmedIndex];
    if (!("hits" in result) || !stemmed || !("hits" in stemmed)) return result;

    const seen = new Set(result.hits.map((hit) => hit.objectID));
    const extra = stemmed.hits.filter((hit) => !seen.has(hit.objectID));
    const hits = [...result.hits, ...extra].slice(0, result.hitsPerPage ?? Number.POSITIVE_INFINITY);
    return { ...result, hits, nbHits: Math.max(result.nbHits ?? 0, stemmed.nbHits ?? 0, hits.length) };
  });
}
