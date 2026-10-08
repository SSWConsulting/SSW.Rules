"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useRulesChatAccess } from "@/components/chat/useRulesChatAccess";
import { openSearch } from "./openSearch";

export function SearchTrigger() {
  const [shortcut, setShortcut] = useState("Ctrl K");
  const label = useRulesChatAccess() ? "Search rules or ask The Rulekeeper" : "Search rules";

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setShortcut("⌘ K");
  }, []);

  // Without an index the search dialog doesn't render, so the button would do nothing.
  if (!process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME) return null;

  // An icon only where the header is tight: phones under 390px, sm (logo and actions share a row) and xl up (the full menu shows).
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label={label}
      title={`${label} (${shortcut})`}
      className="flex h-9 w-9 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm transition-colors hover:border-ssw-red hover:text-ssw-black focus-visible:outline-2 focus-visible:outline-ssw-red focus-visible:outline-offset-2 min-[390px]:max-sm:w-36 min-[390px]:max-sm:justify-start min-[390px]:max-sm:px-3 md:w-44 md:justify-start md:px-3 lg:w-64 xl:w-9 xl:justify-center xl:px-0"
    >
      <Search className="size-4 shrink-0 text-ssw-red" aria-hidden />
      <span className="hidden min-w-0 flex-1 truncate text-left text-sm min-[390px]:max-sm:block md:block xl:hidden">Search rules</span>
      <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-sans text-gray-600 text-xs max-md:hidden xl:hidden">{shortcut}</kbd>
    </button>
  );
}
