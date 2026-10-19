"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useRulesChatAccess } from "@/components/chat/useRulesChatAccess";
import Tooltip from "@/components/tooltip/tooltip";
import { openSearch, SEARCH_TRIGGER_ATTRIBUTE } from "./openSearch";

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
    <Tooltip text={`${label} (${shortcut})`} showDelay={0} hideDelay={0} opaque={true}>
      <button
        type="button"
        onClick={openSearch}
        {...{ [SEARCH_TRIGGER_ATTRIBUTE]: "" }}
        aria-label={label}
        className="flex h-9 w-9 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-black/20 bg-white text-black/60 outline-none transition-colors focus-visible:border-black/45 focus-visible:ring-3 focus-visible:ring-black/10 min-[390px]:max-sm:w-36 min-[390px]:max-sm:justify-start min-[390px]:max-sm:rounded-[4px] min-[390px]:max-sm:px-3 md:w-44 md:rounded-[4px] md:justify-start md:px-3 lg:w-64 xl:w-9 xl:justify-center xl:rounded-full xl:px-0"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden min-w-0 flex-1 truncate text-left text-sm min-[390px]:max-sm:block md:block xl:hidden">Search rules</span>
        <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] bg-black/[0.04] px-1 font-medium font-sans text-xs max-md:hidden xl:hidden">
          {shortcut}
        </kbd>
      </button>
    </Tooltip>
  );
}
