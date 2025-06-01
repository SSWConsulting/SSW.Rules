"use client";

import { InstantSearch, SearchBox } from "react-instantsearch-hooks-web";
import { useState } from "react";
import { searchClient } from "@/lib/algoliaClient";
import SearchNavigator from "./SearchNavigator";

export default function SearchBar() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <InstantSearch
      searchClient={searchClient}
      indexName={process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!}
    >
      <SearchBox
        classNames={{
          root: "p-3",
          form: "relative",
          input:
            "block w-full h-10 pl-9 pr-3 py-2 bg-white border border-slate-300 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 rounded-md focus:ring-1",
          submitIcon: "absolute top-3 left-3 bottom-0 w-4 h-4",
          resetIcon: "hidden",
        }}
        searchAsYouType={false}
        onSubmit={() => setSubmitted(true)}
      />
      <SearchNavigator
        submitted={submitted}
        reset={() => setSubmitted(false)}
      />
    </InstantSearch>
  );
}
