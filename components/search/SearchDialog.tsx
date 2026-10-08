"use client";

import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import type { Hit } from "instantsearch.js";
import { ArrowRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import { Configure, Highlight, InstantSearch, useHits, useInstantSearch, useSearchBox } from "react-instantsearch";
import { askRulekeeper } from "@/components/chat/askRulekeeper";
import { RulekeeperMark } from "@/components/chat/RulekeeperMark";
import { useRulesChatAccess } from "@/components/chat/useRulesChatAccess";
import Spinner from "@/components/Spinner";
import { searchClient } from "@/lib/algoliaClient";
import { onOpenSearch } from "./openSearch";

// The search proxy ignores shorter queries.
const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 8;
const DEBOUNCE_MS = 300;

type RuleHit = { objectID: string; slug: string; title: string; seoDescription?: string };
type Item = { kind: "ask"; query: string } | { kind: "rule"; hit: Hit<RuleHit> } | { kind: "all"; query: string };

const highlightClasses = { highlighted: "bg-ssw-red/15 font-semibold text-ssw-black" };

function Results({ onDone }: { onDone: () => void }) {
  const [input, setInput] = useState("");
  const router = useRouter();
  const { refine } = useSearchBox();
  const { items: hits } = useHits<RuleHit>();
  const { status } = useInstantSearch({ catchError: true });
  const canAsk = useRulesChatAccess();
  const query = input.trim();
  const isSearchable = query.length >= MIN_QUERY_LENGTH;
  // Tracked here because useSearchBox's query only moves on after a successful search.
  const [sentQuery, setSentQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = isSearchable ? query : "";
      refine(next);
      setSentQuery(next);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, isSearchable, refine]);

  // Until the debounced query is sent, hits and status still belong to the previous query.
  const isPending = isSearchable && sentQuery !== query;
  const isLoading = isPending || (isSearchable && (status === "loading" || status === "stalled"));
  const hasError = isSearchable && !isLoading && status === "error";
  const showResults = isSearchable && !isLoading && !hasError;
  const showNoResults = showResults && hits.length === 0;
  // Asking The Rulekeeper is always the first option, so Enter asks; the arrow keys reach the rules.
  const ask: Item[] = canAsk ? [{ kind: "ask", query }] : [];
  const results: Item[] = showResults ? [...hits.map((hit) => ({ kind: "rule" as const, hit })), { kind: "all", query }] : [];
  const items = [...ask, ...results];

  const activate = (item: Item | null) => {
    if (!item) return;
    if (item.kind === "ask") askRulekeeper(item.query);
    else if (item.kind === "rule") router.push(`/${item.hit.slug}`);
    else router.push(`/search?keyword=${encodeURIComponent(item.query)}`);
    onDone();
  };

  const optionsList = useRef<HTMLDivElement>(null);
  // The combobox only highlights an option once the user types, so Enter in an empty box would do nothing.
  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || optionsList.current?.querySelector("[data-focus]")) return;
    const first = items[0]?.kind === "ask" ? items[0] : null;
    if (first) {
      event.preventDefault();
      activate(first);
    }
  };

  return (
    <Combobox value={null} onChange={activate} immediate>
      <div className="flex items-center gap-3 border-gray-200 border-b px-4">
        <Search className="size-5 shrink-0 text-ssw-red" aria-hidden />
        <ComboboxInput
          autoFocus
          aria-label="Search rules"
          placeholder="Search rules..."
          className="h-14 flex-1 bg-transparent text-base text-ssw-black outline-none placeholder:text-gray-500"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onInputKeyDown}
          displayValue={() => input}
        />
        {isLoading && (
          <span role="status" aria-label="Searching">
            <Spinner />
          </span>
        )}
        <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-sans text-gray-600 text-xs">Esc</kbd>
      </div>

      <ComboboxOptions static ref={optionsList} className="max-h-[min(60vh,32rem)] overflow-y-auto p-2 empty:hidden">
        {items.map((item) => (
          <ComboboxOption
            key={item.kind === "rule" ? item.hit.objectID : item.kind}
            value={item}
            className="group cursor-pointer rounded-lg px-3 py-2.5 data-focus:bg-gray-100"
          >
            {item.kind === "ask" && (
              <span className="flex items-center gap-3">
                <RulekeeperMark size="small" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ssw-black">Ask The Rulekeeper</span>
                  <span className="block truncate text-gray-600 text-sm">
                    {item.query ? <>&ldquo;{item.query}&rdquo;</> : "Ask a question and get answers that link to the rules"}
                  </span>
                </span>
                <ArrowRight className="size-4 text-gray-400 group-data-focus:text-ssw-red" aria-hidden />
              </span>
            )}
            {item.kind === "rule" && (
              <span className="block">
                <span className="block font-medium text-ssw-dark-red">
                  <Highlight attribute="title" hit={item.hit} classNames={highlightClasses} />
                </span>
                {/* The index does not search descriptions, so they come back without highlights. */}
                {item.hit.seoDescription && <span className="mt-0.5 line-clamp-2 block text-gray-600 text-sm">{item.hit.seoDescription}</span>}
              </span>
            )}
            {item.kind === "all" && (
              <span className="flex items-center gap-2 text-gray-600 text-sm group-data-focus:text-ssw-black">
                <Search className="size-4" aria-hidden />
                See all results for &ldquo;{item.query}&rdquo;
              </span>
            )}
          </ComboboxOption>
        ))}
      </ComboboxOptions>

      {!isSearchable && <p className="px-4 py-8 text-center text-gray-600">{query ? "Keep typing..." : "Start searching the rules..."}</p>}
      {showNoResults && <p className="px-4 pb-6 text-center text-gray-600">No rules match &ldquo;{query}&rdquo;.</p>}
      {hasError && (
        <p role="alert" className="px-4 py-8 text-center text-gray-600">
          Search is unavailable right now. Try again in a minute.
        </p>
      )}
    </Combobox>
  );
}

export function SearchDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME;

  useEffect(() => onOpenSearch(() => setIsOpen(true)), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!indexName) return null;

  const close = () => setIsOpen(false);

  return (
    <Dialog open={isOpen} onClose={close} aria-label="Search rules" className="relative z-[1200]">
      <DialogBackdrop transition className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm transition-opacity duration-150 data-closed:opacity-0" />
      <div className="fixed inset-0 overflow-y-auto px-4 pt-[12vh] max-sm:pt-4">
        <DialogPanel
          transition
          className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 transition duration-150 data-closed:scale-95 data-closed:opacity-0"
        >
          <InstantSearch searchClient={searchClient} indexName={indexName}>
            <Configure hitsPerPage={MAX_RESULTS} />
            <Results onDone={close} />
          </InstantSearch>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
