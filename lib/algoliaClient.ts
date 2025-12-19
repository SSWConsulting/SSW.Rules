import { liteClient as algoliasearch } from 'algoliasearch/lite';

const base = algoliasearch(process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!, process.env.NEXT_PUBLIC_ALGOLIA_API_KEY!);

export const searchClient = {
    ...base,
    search(requests) {
        const list = Array.isArray(requests) ? requests : [requests];
        if (list.every((r) => 'params' in r && !r.params?.query)) {
            return Promise.resolve({
                results: list.map(() => ({
                    hits: [],
                    nbHits: 0,
                    page: 0,
                    nbPages: 0,
                    hitsPerPage: 20,
                    exhaustiveNbHits: false,
                    query: '',
                    params: '',
                    processingTimeMS: 0,
                })),
            }) as any;
        }
        return base.search(requests as any);
    },
};
