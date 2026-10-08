export const FAILURE_TEXT = "Something went wrong while answering. Please try again.";

type RefusalBody = { reason?: unknown; retryAt?: unknown } | null;

function parseRetryAt(body: RefusalBody): Date | null {
  const retryAt = typeof body?.retryAt === "string" ? new Date(body.retryAt) : null;
  return retryAt && !Number.isNaN(retryAt.getTime()) ? retryAt : null;
}

function dayAndTime(retryAt: Date, now: Date): string {
  const time = retryAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (retryAt.toDateString() === now.toDateString()) return time;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (retryAt.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  return `${retryAt.toLocaleDateString([], { weekday: "long" })} at ${time}`;
}

// What to tell the user when the chat API turns a question down, with times in their own time zone.
export function refusalMessage(status: number, body: RefusalBody, now = new Date()): string {
  if (status === 403) return "The Rulekeeper isn't available for your account.";
  if (status !== 429) return FAILURE_TEXT;

  const retryAt = parseRetryAt(body);
  switch (body?.reason) {
    case "busy":
      return "One question at a time. Wait for the other answer to finish, then ask again.";
    case "minute": {
      const seconds = retryAt ? Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 1000)) : null;
      return seconds ? `That's a lot of questions in a minute. Try again in ${seconds} seconds.` : "That's a lot of questions in a minute. Try again shortly.";
    }
    case "day":
      return retryAt
        ? `You've used today's questions. You can ask again from ${dayAndTime(retryAt, now)}.`
        : "You've used today's questions. Try again tomorrow.";
    case "paused":
      return retryAt
        ? `The Rulekeeper has reached its limit for this month. It's back on ${retryAt.toLocaleDateString([], { day: "numeric", month: "long" })}.`
        : "The Rulekeeper has reached its limit for this month.";
    default:
      return FAILURE_TEXT;
  }
}
