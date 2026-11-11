/**
 * @jest-environment node
 */
import type { RulesChatLimits } from "@/lib/rulesChat/config";
import { checkLimits, PER_MINUTE_LIMIT, STAFF_DAILY_LIMIT, type Usage } from "@/lib/rulesChat/usage";

const now = new Date("2026-10-08T10:00:00Z");
const limits: RulesChatLimits = { memberDailyLimit: 20, monthlyBudgetUsd: 100, inputPricePerMillionTokensUsd: 1, outputPricePerMillionTokensUsd: 4 };
const quiet: Usage = { running: 0, minuteCount: 0, minuteOldest: null, dayCount: 0, dayOldest: null, monthTokens: { inputTokens: 0, outputTokens: 0 } };
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
// $100 at $4 per million output tokens.
const overBudget = { inputTokens: 0, outputTokens: 25_000_000 };

describe("checkLimits", () => {
  it("allows a first question without a remaining count", () => {
    expect(checkLimits(quiet, "staff", limits, now)).toEqual({ allowed: true, remainingToday: null });
    expect(checkLimits(quiet, "member", limits, now)).toEqual({ allowed: true, remainingToday: null });
  });

  it("tells non-staff how many questions are left once 5 or fewer remain", () => {
    expect(checkLimits({ ...quiet, dayCount: 14 }, "member", limits, now)).toEqual({ allowed: true, remainingToday: 5 });
    expect(checkLimits({ ...quiet, dayCount: 19 }, "member", limits, now)).toEqual({ allowed: true, remainingToday: 0 });
  });

  it("never shows staff a remaining count", () => {
    expect(checkLimits({ ...quiet, dayCount: STAFF_DAILY_LIMIT - 1 }, "staff", limits, now)).toEqual({ allowed: true, remainingToday: null });
  });

  it("allows one answer at a time", () => {
    expect(checkLimits({ ...quiet, running: 1 }, "staff", limits, now)).toEqual({ allowed: false, reason: "busy", retryAt: null });
  });

  it("blocks the question over the per-minute limit until the oldest one is a minute old", () => {
    const usage = { ...quiet, minuteCount: PER_MINUTE_LIMIT, minuteOldest: new Date(now.getTime() - 45_000), dayCount: PER_MINUTE_LIMIT };
    expect(checkLimits(usage, "staff", limits, now)).toEqual({ allowed: false, reason: "minute", retryAt: new Date(now.getTime() + 15_000) });
    expect(checkLimits({ ...usage, minuteCount: PER_MINUTE_LIMIT - 1 }, "staff", limits, now).allowed).toBe(true);
  });

  it("blocks each tier at its own daily limit until the oldest question is 24 hours old", () => {
    const dayOldest = minutesAgo(23 * 60);
    expect(checkLimits({ ...quiet, dayCount: 20, dayOldest }, "member", limits, now)).toEqual({
      allowed: false,
      reason: "day",
      retryAt: new Date(dayOldest.getTime() + 24 * 60 * 60_000),
    });
    expect(checkLimits({ ...quiet, dayCount: 20, dayOldest }, "staff", limits, now).allowed).toBe(true);
    expect(checkLimits({ ...quiet, dayCount: STAFF_DAILY_LIMIT, dayOldest }, "staff", limits, now)).toMatchObject({ allowed: false, reason: "day" });
  });

  it("pauses non-staff at the monthly budget until the next month, and lets staff carry on", () => {
    const usage = { ...quiet, monthTokens: overBudget };
    expect(checkLimits(usage, "member", limits, now)).toEqual({ allowed: false, reason: "paused", retryAt: new Date("2026-11-01T00:00:00Z") });
    expect(checkLimits(usage, "staff", limits, now).allowed).toBe(true);
  });

  it("allows non-staff just under the monthly budget", () => {
    const usage = { ...quiet, monthTokens: { inputTokens: 0, outputTokens: overBudget.outputTokens - 1 } };
    expect(checkLimits(usage, "member", limits, now).allowed).toBe(true);
  });
});
