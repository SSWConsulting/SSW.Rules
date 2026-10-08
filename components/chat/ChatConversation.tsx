"use client";

import { ArrowUp } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MAX_MESSAGE_CHARS } from "@/lib/rulesChat/limits";
import { onAskRulekeeper } from "./askRulekeeper";
import { isCitedRuleLink, linkCitations } from "./citations";
import { RulekeeperMark } from "./RulekeeperMark";
import { type ChatMessage, useChatMessages } from "./useChatMessages";

const SUGGESTIONS = ["Do you have a rule about pull requests?", "Do you have a rule about email etiquette?", "Do you have a rule about Definition of Done?"];

export type ChatActivity = { isAnswering: boolean; answerCount: number };

export function ChatTitle() {
  return (
    <div className="flex min-w-0 items-center gap-2 text-white">
      <RulekeeperMark size="small" />
      <span className="truncate font-semibold">The Rulekeeper</span>
      <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-white">Beta</span>
    </div>
  );
}

const linkClass = "font-medium text-ssw-dark-red underline underline-offset-2 hover:text-ssw-red";

function Message({ message, openLinksInNewTab }: { message: ChatMessage; openLinksInNewTab: boolean }) {
  const target = openLinksInNewTab ? "_blank" : undefined;
  if (message.role === "user") {
    return (
      <div className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-ssw-red px-3.5 py-2 text-sm text-white">
        {message.text}
      </div>
    );
  }
  return (
    <div className="max-w-[92%] self-start break-words rounded-2xl rounded-bl-sm bg-gray-100 px-3.5 py-2 text-sm text-ssw-black leading-relaxed">
      {message.text ? (
        <div className="[&_li]:mb-1 [&_ol]:mb-2 [&_ol]:ps-5 [&_p:last-child]:mb-0 [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:ps-5">
          <ReactMarkdown
            disallowedElements={["img"]}
            components={{
              a: ({ href, children }) =>
                isCitedRuleLink(href, message.sources) ? (
                  <Link href={href} target={target} className={linkClass}>
                    {children}
                  </Link>
                ) : (
                  <>{children}</>
                ),
            }}
          >
            {linkCitations(message.text, message.sources)}
          </ReactMarkdown>
        </div>
      ) : (
        <span className="animate-pulse text-gray-600">Checking the rules...</span>
      )}
      {message.sources && message.sources.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 border-black/10 border-t pt-2">
          {message.sources.map((source) => (
            <Link key={source.number} href={source.href} target={target} className={linkClass}>
              [{source.number}] {source.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatConversation({
  openLinksInNewTab = false,
  isVisible = true,
  onActivity,
}: {
  openLinksInNewTab?: boolean;
  isVisible?: boolean;
  onActivity?: (activity: ChatActivity) => void;
}) {
  const { messages, pending, remainingToday, send, clear } = useChatMessages();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const answerCount = messages.filter((message) => message.role === "assistant").length;

  useEffect(() => {
    onActivity?.({ isAnswering: pending !== null, answerCount });
  }, [onActivity, pending, answerCount]);

  // Wait out the search dialog's closing, which hands focus back to the button that opened it.
  useEffect(() => {
    if (!isVisible) return;
    const timer = window.setTimeout(() => input.current?.focus(), 200);
    return () => window.clearTimeout(timer);
  }, [isVisible]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, pending?.text]);

  // Read through a ref so the listener below always sees the current conversation state.
  const askFromElsewhere = useRef<(question: string) => void>(() => {});
  askFromElsewhere.current = (question) => {
    if (!question) return;
    // While an answer is still streaming, the question waits in the box instead of being lost.
    if (pending) setDraft(question.slice(0, MAX_MESSAGE_CHARS));
    else send(question.slice(0, MAX_MESSAGE_CHARS));
  };
  useEffect(() => onAskRulekeeper((question) => askFromElsewhere.current(question)), []);

  const submit = (text: string) => {
    const question = text.trim();
    if (!question || pending) return;
    send(question);
    setDraft("");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(draft);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
        {messages.length === 0 && !pending ? (
          <div className="m-auto flex flex-col items-center gap-3 text-center">
            <RulekeeperMark size="large" />
            <p className="text-lg font-semibold text-ssw-black">Ask The Rulekeeper about SSW Rules</p>
            <p className="max-w-72 text-sm text-gray-600">There's a rule for that. Probably several. Answers link to the rules they come from.</p>
            <div className="mt-2 flex flex-col gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submit(suggestion)}
                  className="cursor-pointer rounded-full border border-gray-300 px-3.5 py-1.5 text-sm text-ssw-black transition-colors hover:border-ssw-red hover:text-ssw-dark-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ssw-red"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Plain divs: the site's global list styles add bullets and margins to ul/li. Busy while an answer streams,
          // so a screen reader reads the finished answer once instead of every fragment.
          <div role="log" aria-live="polite" aria-busy={pending !== null} className="flex flex-col gap-3">
            {messages.map((message) => (
              <Message key={message.id} message={message} openLinksInNewTab={openLinksInNewTab} />
            ))}
            {pending && <Message message={pending} openLinksInNewTab={openLinksInNewTab} />}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 px-3 pt-3 pb-2">
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 rounded-2xl border border-gray-300 py-1.5 pr-1.5 pl-3.5 focus-within:border-ssw-red focus-within:ring-2 focus-within:ring-ssw-red/20"
        >
          <textarea
            ref={input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_MESSAGE_CHARS}
            placeholder="Do you have a rule about..."
            aria-label="Your question"
            className="field-sizing-content max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1 text-sm text-ssw-black outline-none placeholder:text-gray-500"
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending !== null}
            aria-label="Send"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ssw-red text-white transition-colors hover:bg-ssw-dark-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ssw-red disabled:cursor-default disabled:bg-gray-200 disabled:text-gray-500"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </form>
        <div className="mt-1.5 flex h-5 items-center justify-between px-1 text-xs text-gray-600">
          {remainingToday === null ? (
            <span>Enter to send, Shift+Enter for a new line</span>
          ) : (
            <span className="font-medium text-ssw-black">
              {remainingToday === 0 ? "No questions left today" : `${remainingToday} ${remainingToday === 1 ? "question" : "questions"} left today`}
            </span>
          )}
          {messages.length > 0 && !pending && (
            <button type="button" onClick={clear} className="cursor-pointer underline underline-offset-2 hover:text-ssw-dark-red">
              New chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
