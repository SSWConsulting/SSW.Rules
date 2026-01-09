import { withBasePath } from "./withBasePath";

// Server-side proxy client to protect API keys and add rate limiting
export const searchClient = {
  search(requests: any) {
    const list = Array.isArray(requests) ? requests : [requests];

    // Return empty results if no query
    if (list.every((r) => "params" in r && !r.params?.query)) {
      return Promise.resolve({
        results: list.map(() => ({
          hits: [],
          nbHits: 0,
          page: 0,
          nbPages: 0,
          hitsPerPage: 20,
          exhaustiveNbHits: false,
          query: "",
          params: "",
          processingTimeMS: 0,
        })),
      }) as any;
    }

    // Proxy through server-side API route for security and rate limiting
    return fetch(withBasePath("/api/search"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests: list }),
    }).then((response) => {
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        throw new Error(`Search failed: ${response.statusText}`);
      }
      return response.json();
    });
  },
};
