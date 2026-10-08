import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { useAuth } from "@/components/auth/UserClientProvider";
import { MAX_MESSAGE_CHARS } from "@/lib/rulesChat/limits";
import { type ChatSource, numberCitations } from "./citations";
import { FAILURE_TEXT, refusalMessage } from "./refusalMessage";

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; sources?: ChatSource[]; failed?: boolean };

const CHAT_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`;

// A refusal the user can act on, such as a limit, shown in place of the generic failure.
class RefusedError extends Error {}

type StreamLine = { type: "sources"; sources: ChatSource[]; remainingToday: number | null } | { type: "delta"; text: string } | { type: "error" };

async function* readLines(response: Response): AsyncGenerator<StreamLine> {
  if (!response.body) throw new Error("The chat response had no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line);
  }
}

// Kept in localStorage so the floating panel and the popped-out window show the same conversation.
const MESSAGES_KEY = "ssw.rulesChat.messages.v3";
const OWNER_KEY = "ssw.rulesChat.owner.v1";

// A conversation belongs to the user who had it, so on a shared computer the next person never sees it.
// Signing out, or another user signing in, clears it.
export function useClearChatOfOtherUsers() {
  const { user, isLoading } = useAuth();
  const userSub = user?.sub ?? null;

  useEffect(() => {
    if (isLoading) return;
    try {
      if (window.localStorage.getItem(OWNER_KEY) === userSub) return;
      window.localStorage.removeItem(MESSAGES_KEY);
      if (userSub) window.localStorage.setItem(OWNER_KEY, userSub);
      else window.localStorage.removeItem(OWNER_KEY);
      // Lets a conversation already on screen, such as the pop-out window's, re-read the now empty storage.
      window.dispatchEvent(new StorageEvent("storage", { key: MESSAGES_KEY }));
    } catch (error) {
      console.error("[RulesChat] clearing another user's conversation failed:", error);
    }
  }, [isLoading, userSub]);
}

export function useChatMessages() {
  const [messages, setMessages, clear] = useLocalStorage<ChatMessage[]>(MESSAGES_KEY, [], { initializeWithValue: false });
  // The reply being streamed. It joins `messages` once complete, so storage is written once per answer.
  const [pending, setPending] = useState<ChatMessage | null>(null);
  // Only set for non-staff close to their daily limit.
  const [remainingToday, setRemainingToday] = useState<number | null>(null);

  const send = async (text: string) => {
    const history: ChatMessage[] = [...messages, { id: crypto.randomUUID(), role: "user", text }];
    setMessages(history);

    // Every rule cited so far, so each keeps one number for the whole conversation.
    const known = [...new Map(messages.flatMap((message) => message.sources ?? []).map((source) => [source.href, source])).values()];

    let reply: ChatMessage = { id: crypto.randomUUID(), role: "assistant", text: "" };
    let retrieved: ChatSource[] = [];
    let answer = "";
    setPending(reply);
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((message) => !message.failed).map((message) => ({ role: message.role, content: message.text.slice(0, MAX_MESSAGE_CHARS) })),
          citedRules: known.map((source) => ({ number: source.number, uri: source.href.slice(1) })),
        }),
      });
      if (!response.ok) {
        setRemainingToday(null);
        const body = await response.json().catch(() => null);
        throw new RefusedError(refusalMessage(response.status, body));
      }
      for await (const line of readLines(response)) {
        if (line.type === "sources") {
          retrieved = line.sources;
          setRemainingToday(line.remainingToday);
        } else if (line.type === "error") throw new Error("The chat API reported a failure");
        else {
          answer += line.text;
          reply = { ...reply, ...numberCitations(answer, retrieved, known) };
          setPending(reply);
        }
      }
      if (!reply.text.trim()) throw new Error("The chat returned an empty answer");
    } catch (error) {
      if (error instanceof RefusedError) console.warn("[RulesChat] question refused:", error.message);
      else console.error("[RulesChat] sending a message failed:", error);
      reply = { ...reply, text: error instanceof RefusedError ? error.message : FAILURE_TEXT, sources: undefined, failed: true };
    }
    setMessages((previous) => [...previous, reply]);
    setPending(null);
  };

  return { messages, pending, remainingToday, send, clear };
}
