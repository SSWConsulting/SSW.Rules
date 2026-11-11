import { FAILURE_TEXT, refusalMessage, TOO_LONG_TEXT } from "@/components/chat/refusalMessage";

const now = new Date(2026, 9, 8, 10, 0, 0);
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
const at = (date: Date) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

describe("refusalMessage", () => {
  it.each([400, 413])("asks for a new chat when the request is refused as too long (%i)", (status) => {
    expect(refusalMessage(status, null, now)).toBe(TOO_LONG_TEXT);
  });

  it("says how many seconds to wait after too many questions in a minute", () => {
    expect(refusalMessage(429, { reason: "minute", retryAt: new Date(now.getTime() + 14_200).toISOString() }, now)).toBe(
      "That's a lot of questions in a minute. Try again in 15 seconds."
    );
  });

  it("says when today's questions come back, in the reader's time zone", () => {
    const retryAt = new Date(now.getTime() + 3 * 60 * 60_000);
    expect(refusalMessage(429, { reason: "day", retryAt: retryAt.toISOString() }, now)).toBe(
      `You've used today's questions. You can ask again from ${at(retryAt)}.`
    );
  });

  it("says tomorrow when the daily limit resets after midnight", () => {
    const retryAt = new Date(2026, 9, 9, 9, 30);
    expect(refusalMessage(429, { reason: "day", retryAt: retryAt.toISOString() }, now)).toBe(
      `You've used today's questions. You can ask again from tomorrow at ${at(retryAt)}.`
    );
  });

  it("asks for one question at a time", () => {
    expect(refusalMessage(429, { reason: "busy", retryAt: null }, now)).toBe("One question at a time. Wait for the other answer to finish, then ask again.");
  });

  it("names the day the monthly pause ends", () => {
    const message = refusalMessage(429, { reason: "paused", retryAt: later(60 * 24 * 20) }, now);
    expect(message).toMatch(/^The Rulekeeper has reached its limit for this month\. It's back on .+\.$/);
  });

  it("falls back to plain wording without a usable retry time", () => {
    expect(refusalMessage(429, { reason: "day", retryAt: "not a date" }, now)).toBe("You've used today's questions. Try again tomorrow.");
  });

  it("explains a refused account and treats anything else as a failure", () => {
    expect(refusalMessage(403, null, now)).toBe("The Rulekeeper isn't available for your account.");
    expect(refusalMessage(500, null, now)).toBe(FAILURE_TEXT);
    expect(refusalMessage(429, { reason: "unknown" }, now)).toBe(FAILURE_TEXT);
  });
});
