"use client";

import { ExternalLink, Minus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useIsClient, useLocalStorage, useMediaQuery, useSessionStorage, useWindowSize } from "usehooks-ts";
import { cn } from "@/lib/utils";
import { onAskRulekeeper } from "./askRulekeeper";
import { type ChatActivity, ChatConversation, ChatTitle } from "./ChatConversation";
import {
  type Anchor,
  type AnchorSide,
  anchorSide,
  clampAnchor,
  DEFAULT_ANCHOR,
  DEFAULT_PANEL_SIZE,
  type PanelSize,
  PILL_SIZE,
  panelAtAnchor,
  pillPosition,
  resizePanel,
  usePointerDrag,
} from "./floating";
import { RulekeeperMark } from "./RulekeeperMark";
import { useClearChatOfOtherUsers } from "./useChatMessages";
import { useRulesChatAccess } from "./useRulesChatAccess";

const CHAT_POPOUT_PATH = "/chat";
const POPOUT_WINDOW_NAME = "sswRulesChat";

// "closed": nothing on screen; the chat is reopened from search. "minimised": a small pill that shows
// progress and unread answers. Kept per browser tab, so a reload leaves the chat where it was.
type Mode = "closed" | "open" | "minimised";

const headerButton =
  "flex size-8 cursor-pointer items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white";

export function ChatWidget() {
  const isClient = useIsClient();
  const hasAccess = useRulesChatAccess();
  const pathname = usePathname();
  const viewport = useWindowSize();
  const isPhone = useMediaQuery("(max-width: 639px)");
  const [mode, setMode] = useSessionStorage<Mode>("ssw.rulesChat.mode.v1", "closed");
  const [anchorChoice, setAnchorChoice] = useLocalStorage<Anchor>("ssw.rulesChat.anchor.v1", DEFAULT_ANCHOR);
  const [panelSize, setPanelSize] = useLocalStorage<PanelSize>("ssw.rulesChat.panelSize.v1", DEFAULT_PANEL_SIZE);
  // Held while dragging, so the window does not flip to the other side under the cursor.
  const [sideWhileDragging, setSideWhileDragging] = useState<AnchorSide | null>(null);
  const [activity, setActivity] = useState<ChatActivity>({ isAnswering: false, answerCount: 0 });
  const [hasUnread, setHasUnread] = useState(false);
  const [popOutBlocked, setPopOutBlocked] = useState(false);
  const seenAnswerCount = useRef<number | null>(null);

  const anchor = clampAnchor(anchorChoice, viewport);
  const side = sideWhileDragging ?? anchorSide(anchor, viewport);
  const panel = panelAtAnchor(anchor, panelSize, side, viewport);
  const pill = pillPosition(anchor, viewport);

  const moveDrag = usePointerDrag({
    begin: () => {
      setSideWhileDragging(side);
      return anchor;
    },
    move: (start, deltaX, deltaY) => setAnchorChoice(clampAnchor({ right: start.right - deltaX, bottom: start.bottom - deltaY }, viewport)),
    end: () => setSideWhileDragging(null),
  });
  const resizeDrag = usePointerDrag({
    begin: () => panel,
    move: (start, deltaX, deltaY) => setPanelSize(resizePanel(start, side, deltaX, deltaY, viewport)),
  });

  useClearChatOfOtherUsers();
  useEffect(() => onAskRulekeeper(() => setMode("open")), [setMode]);

  // An answer that finishes while the chat is out of view is flagged on the pill until the chat is opened.
  useEffect(() => {
    if (mode === "open") {
      seenAnswerCount.current = activity.answerCount;
      setHasUnread(false);
    } else if (seenAnswerCount.current !== null && activity.answerCount > seenAnswerCount.current) {
      setHasUnread(true);
    }
  }, [mode, activity.answerCount]);

  if (!isClient || !hasAccess || pathname === CHAT_POPOUT_PATH) return null;

  // The separate window shares the conversation through local storage, so this one can simply close.
  const popOut = () => {
    const opened = window.open(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${CHAT_POPOUT_PATH}`, POPOUT_WINDOW_NAME, "popup,width=480,height=720");
    if (!opened || opened.closed) {
      setPopOutBlocked(true);
      return;
    }
    setPopOutBlocked(false);
    setMode("closed");
  };

  const onPanelKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      setMode("minimised");
    }
  };

  return (
    <>
      <section
        aria-label="The Rulekeeper"
        onKeyDown={onPanelKeyDown}
        // Stays mounted while hidden so a half-typed question and a streaming answer survive.
        className={cn(
          "fade-in zoom-in-95 fixed z-[1000] animate-in shadow-2xl shadow-black/30 duration-150 max-sm:inset-0 sm:rounded-2xl",
          mode !== "open" && "hidden"
        )}
        style={isPhone ? undefined : panel}
      >
        {/* The resize handle sits outside this box: its rounded clipping would swallow most of the corner. */}
        <div className="flex size-full flex-col overflow-hidden border border-black/10 bg-white sm:rounded-2xl">
          <header
            className="flex shrink-0 select-none items-center justify-between gap-2 bg-ssw-black py-2 pr-2 pl-3 sm:cursor-move sm:touch-none"
            {...(isPhone ? {} : moveDrag)}
          >
            <ChatTitle />
            <div className="flex items-center">
              <button
                type="button"
                onClick={popOut}
                className={cn(headerButton, "max-sm:hidden")}
                aria-label="Open in a separate window"
                title="Open in a separate window"
              >
                <ExternalLink className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => setMode("minimised")} className={headerButton} aria-label="Minimise" title="Minimise (Esc)">
                <Minus className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => setMode("closed")} className={headerButton} aria-label="Close" title="Close">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </header>
          {popOutBlocked && (
            <p role="alert" className="shrink-0 bg-amber-100 px-4 py-2 text-amber-950 text-sm">
              Your browser blocked the separate window. Allow pop-ups for this site and try again.
            </p>
          )}
          <ChatConversation isVisible={mode === "open"} onActivity={setActivity} />
        </div>
        {/* The one corner that is not tied to the anchor. */}
        <div
          aria-hidden
          className={cn(
            "absolute size-5 touch-none select-none max-sm:hidden",
            side.isLeft ? "-right-1" : "-left-1",
            side.isTop ? "-bottom-1" : "-top-1",
            side.isLeft === side.isTop ? "cursor-nwse-resize" : "cursor-nesw-resize"
          )}
          {...resizeDrag}
        />
      </section>

      {mode === "minimised" && (
        <div
          className="fade-in slide-in-from-bottom-2 fixed z-[1000] flex animate-in touch-none select-none items-center rounded-full bg-ssw-black text-white shadow-black/30 shadow-lg duration-150"
          style={{ ...pill, ...PILL_SIZE }}
          {...moveDrag}
        >
          <button
            type="button"
            onClick={() => setMode("open")}
            className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-l-full pr-1 pl-1.5 focus-visible:outline-2 focus-visible:outline-ssw-red focus-visible:outline-offset-2"
            aria-label={hasUnread ? "Open The Rulekeeper, new answer" : "Open The Rulekeeper"}
          >
            <RulekeeperMark size="small" />
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate font-semibold text-sm">The Rulekeeper</span>
              <span className={cn("block truncate text-xs", hasUnread ? "text-white" : "text-white/70")}>
                {activity.isAnswering ? "Checking the rules..." : hasUnread ? "New answer" : "Continue chat"}
              </span>
            </span>
            {hasUnread && <span className="size-2.5 shrink-0 rounded-full bg-ssw-red ring-2 ring-ssw-black" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => setMode("closed")}
            className="mr-1.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/70 hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Close The Rulekeeper"
            title="Close"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
