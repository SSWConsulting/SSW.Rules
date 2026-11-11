import { NextResponse } from "next/server";
import { getAuth0 } from "@/lib/auth0";
import { streamAnswer } from "@/lib/rulesChat/answer";
import { getRulesChatLimits } from "@/lib/rulesChat/config";
import { MAX_HISTORY_QUESTIONS, MAX_MESSAGE_CHARS } from "@/lib/rulesChat/limits";
import { numberSources, parseCitedRules, referencedUris } from "@/lib/rulesChat/numbering";
import { isCrossSiteRequest, MAX_BODY_BYTES, readJsonBody } from "@/lib/rulesChat/request";
import { searchRules } from "@/lib/rulesChat/search";
import {
  finishQuestion,
  type LimitReason,
  logQuestion,
  type QuestionOutcome,
  type StartedQuestion,
  startQuestion,
  type TokenUsage,
} from "@/lib/rulesChat/usage";
import { getRulesChatTier } from "@/lib/rulesChatAccess";

export const dynamic = "force-dynamic";

const ANSWER_TIMEOUT_MS = 90_000;

// The chat window shows its own wording with the retry time in the reader's time zone; these are for other callers.
const LIMIT_MESSAGES: Record<LimitReason, string> = {
  busy: "One question at a time. Wait for the answer to finish.",
  minute: "Too many questions in a minute. Wait a moment and try again.",
  day: "You've reached today's question limit.",
  paused: "The Rulekeeper has reached its monthly limit.",
};

type ChatTurn = { role: "user" | "assistant"; content: string };

// The latest questions, newest last. Earlier answers are not read: see streamAnswer.
function parseQuestions(body: unknown): string[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const questions: string[] = [];
  let lastRole: ChatTurn["role"] = "user";
  for (const message of messages) {
    const { role, content } = (message ?? {}) as Partial<ChatTurn>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim() || content.length > MAX_MESSAGE_CHARS) return null;
    if (role === "user") questions.push(content.trim());
    lastRole = role;
  }
  return lastRole === "user" ? questions.slice(-MAX_HISTORY_QUESTIONS) : null;
}

// Responds with newline-delimited JSON: one "sources" line, then "delta" lines, or an "error" line.
export async function POST(request: Request) {
  // A cross-site form cannot send JSON, so this also rejects forged requests.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  if (isCrossSiteRequest(request.headers)) return NextResponse.json({ error: "Requests from other sites are not allowed" }, { status: 403 });

  const session = await getAuth0().getSession();
  const tier = await getRulesChatTier(session?.user);
  if (!session || !tier) return NextResponse.json({ error: "The Rulekeeper is not available for this account" }, { status: 403 });
  const userSub = session.user.sub;

  const read = await readJsonBody(request);
  if (read.tooLarge) return NextResponse.json({ error: `The request must be ${MAX_BODY_BYTES / 1024} KB or smaller` }, { status: 413 });
  const body = read.value;
  const questions = parseQuestions(body);
  if (!questions)
    return NextResponse.json({ error: `Send 1 or more messages of up to ${MAX_MESSAGE_CHARS} characters, ending with a user message` }, { status: 400 });
  const citedRules = parseCitedRules((body as { citedRules?: unknown }).citedRules);
  if (!citedRules) return NextResponse.json({ error: "citedRules must be a list of { number, uri }" }, { status: 400 });

  let started: StartedQuestion;
  try {
    started = await startQuestion(userSub, tier, getRulesChatLimits());
  } catch (error) {
    console.error("[RulesChat] usage check failed:", error);
    return NextResponse.json({ error: "The Rulekeeper is unavailable right now. Try again soon." }, { status: 503 });
  }
  if (!started.allowed) {
    const { reason, retryAt } = started;
    logQuestion({ userSub, tier, outcome: `limited:${reason}` });
    return NextResponse.json({ error: LIMIT_MESSAGES[reason], reason, retryAt: retryAt?.toISOString() ?? null }, { status: 429 });
  }
  const { usageId, remainingToday } = started;

  const startedAt = Date.now();
  // The response stream's cancel() fires when the reader goes, even if request.signal doesn't.
  const readerGone = new AbortController();
  const signal = AbortSignal.any([request.signal, readerGone.signal, AbortSignal.timeout(ANSWER_TIMEOUT_MS)]);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: object) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      const tokens: TokenUsage = { inputTokens: 0, outputTokens: 0 };
      let outcome: QuestionOutcome = "answered";
      try {
        // A follow-up like "and for emails?" only makes sense next to the question before it.
        const question = questions[questions.length - 1];
        const found = await searchRules(questions.slice(-2).join("\n"), referencedUris(question, citedRules), signal);
        const sources = numberSources(found, citedRules);
        send({
          type: "sources",
          sources: sources.map(({ number, uri, title }) => ({ number, title, href: `/${uri}` })),
          remainingToday,
        });
        for await (const text of streamAnswer(questions, sources, signal, tokens)) send({ type: "delta", text });
        controller.close();
      } catch (error) {
        // The reader has gone, so there is nobody to tell and the stream is already closed.
        if (request.signal.aborted || readerGone.signal.aborted) {
          outcome = "cancelled";
          return;
        }
        outcome = "failed";
        console.error("[RulesChat] answer failed:", error);
        send({ type: "error" });
        controller.close();
      } finally {
        logQuestion({ userSub, tier, outcome, durationMs: Date.now() - startedAt, tokens });
        await finishQuestion(usageId, outcome, tokens).catch((error) => console.error("[RulesChat] recording usage failed:", error));
      }
    },
    cancel() {
      readerGone.abort();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
