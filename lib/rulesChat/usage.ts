import sql from "mssql";
import type { RulesChatTier } from "@/lib/rulesChatAccess";
import type { RulesChatLimits } from "./config";
import { getPool } from "./db";

export const PER_MINUTE_LIMIT = 10;
export const STAFF_DAILY_LIMIT = 200;
// Non-staff are told how many questions they have left once it gets this low.
const REMAINING_HINT_FROM = 5;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
// Answers time out after 90 seconds, so an unfinished row older than this was left by a server that stopped mid-answer.
const RUNNING_MS = 2 * MINUTE_MS;

export type LimitReason = "minute" | "busy" | "day" | "paused";
export type QuestionOutcome = "answered" | "failed" | "cancelled";
export type TokenUsage = { inputTokens: number; outputTokens: number };

export type Usage = {
  running: number;
  minuteCount: number;
  minuteOldest: Date | null;
  dayCount: number;
  dayOldest: Date | null;
  monthTokens: TokenUsage;
};

export type LimitCheck = { allowed: true; remainingToday: number | null } | { allowed: false; reason: LimitReason; retryAt: Date | null };

function startOfNextMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function costUsd(tokens: TokenUsage, limits: RulesChatLimits): number {
  return (tokens.inputTokens * limits.inputPricePerMillionTokensUsd + tokens.outputTokens * limits.outputPricePerMillionTokensUsd) / 1_000_000;
}

// Days are rolling 24 hours, so nobody's limit depends on their time zone.
export function checkLimits(usage: Usage, tier: RulesChatTier, limits: RulesChatLimits, now: Date): LimitCheck {
  // At the monthly cap only non-staff are paused; staff keep their own daily cap.
  if (tier === "member" && costUsd(usage.monthTokens, limits) >= limits.monthlyBudgetUsd)
    return { allowed: false, reason: "paused", retryAt: startOfNextMonthUtc(now) };
  if (usage.running > 0) return { allowed: false, reason: "busy", retryAt: null };
  if (usage.minuteCount >= PER_MINUTE_LIMIT)
    return { allowed: false, reason: "minute", retryAt: usage.minuteOldest && new Date(usage.minuteOldest.getTime() + MINUTE_MS) };
  const dailyLimit = tier === "staff" ? STAFF_DAILY_LIMIT : limits.memberDailyLimit;
  if (usage.dayCount >= dailyLimit) return { allowed: false, reason: "day", retryAt: usage.dayOldest && new Date(usage.dayOldest.getTime() + DAY_MS) };
  const remaining = dailyLimit - usage.dayCount - 1;
  return { allowed: true, remainingToday: tier === "member" && remaining <= REMAINING_HINT_FROM ? remaining : null };
}

export type StartedQuestion = { allowed: true; usageId: string; remainingToday: number | null } | Extract<LimitCheck, { allowed: false }>;

type UsageRow = {
  Running: number;
  MinuteCount: number;
  MinuteOldest: Date | null;
  DayCount: number;
  DayOldest: Date | null;
  // BIGINT sums arrive as strings.
  MonthInputTokens: string;
  MonthOutputTokens: string;
};

// Checks the limits and records the question in one transaction. The per-user lock stops parallel requests
// from all reading the same counts and slipping under a limit together.
export async function startQuestion(userSub: string, tier: RulesChatTier, limits: RulesChatLimits, now = new Date()): Promise<StartedQuestion> {
  const transaction = new sql.Transaction(await getPool());
  await transaction.begin();
  try {
    const counted = await new sql.Request(transaction)
      .input("resource", sql.NVarChar(255), `RulesChat:${userSub}`)
      .input("sub", sql.NVarChar(200), userSub)
      .input("dayStart", sql.DateTime2, new Date(now.getTime() - DAY_MS))
      .input("minuteStart", sql.DateTime2, new Date(now.getTime() - MINUTE_MS))
      .input("runningStart", sql.DateTime2, new Date(now.getTime() - RUNNING_MS))
      .input("monthStart", sql.DateTime2, startOfMonthUtc(now))
      .query<UsageRow>(`
        DECLARE @locked INT;
        EXEC @locked = sp_getapplock @Resource = @resource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
        IF @locked < 0 THROW 50001, 'Timed out waiting for the chat usage lock', 1;

        SELECT
          COUNT(*) AS DayCount,
          MIN(StartedAt) AS DayOldest,
          ISNULL(SUM(CASE WHEN StartedAt > @minuteStart THEN 1 ELSE 0 END), 0) AS MinuteCount,
          MIN(CASE WHEN StartedAt > @minuteStart THEN StartedAt END) AS MinuteOldest,
          ISNULL(SUM(CASE WHEN FinishedAt IS NULL AND StartedAt > @runningStart THEN 1 ELSE 0 END), 0) AS Running,
          (SELECT ISNULL(SUM(CAST(InputTokens AS BIGINT)), 0) FROM dbo.ChatUsage WHERE StartedAt >= @monthStart) AS MonthInputTokens,
          (SELECT ISNULL(SUM(CAST(OutputTokens AS BIGINT)), 0) FROM dbo.ChatUsage WHERE StartedAt >= @monthStart) AS MonthOutputTokens
        FROM dbo.ChatUsage
        WHERE UserSub = @sub AND StartedAt > @dayStart;`);
    const row = counted.recordset[0];
    const usage: Usage = {
      running: row.Running,
      minuteCount: row.MinuteCount,
      minuteOldest: row.MinuteOldest,
      dayCount: row.DayCount,
      dayOldest: row.DayOldest,
      monthTokens: { inputTokens: Number(row.MonthInputTokens), outputTokens: Number(row.MonthOutputTokens) },
    };

    const check = checkLimits(usage, tier, limits, now);
    if (!check.allowed) {
      await transaction.commit();
      return check;
    }
    const inserted = await new sql.Request(transaction)
      .input("sub", sql.NVarChar(200), userSub)
      .input("isStaff", sql.Bit, tier === "staff")
      .input("now", sql.DateTime2, now)
      .query<{ Id: string }>("INSERT INTO dbo.ChatUsage (UserSub, IsStaff, StartedAt) OUTPUT INSERTED.Id VALUES (@sub, @isStaff, @now)");
    await transaction.commit();
    return { ...check, usageId: inserted.recordset[0].Id };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function finishQuestion(usageId: string, outcome: QuestionOutcome, tokens: TokenUsage): Promise<void> {
  await (await getPool())
    .request()
    .input("id", sql.BigInt, usageId)
    .input("outcome", sql.VarChar(20), outcome)
    .input("inputTokens", sql.Int, tokens.inputTokens)
    .input("outputTokens", sql.Int, tokens.outputTokens)
    .query(
      "UPDATE dbo.ChatUsage SET FinishedAt = SYSUTCDATETIME(), Outcome = @outcome, InputTokens = @inputTokens, OutputTokens = @outputTokens WHERE Id = @id"
    );
}

// One line per question for App Insights. Never includes the question or the answer.
export function logQuestion(entry: {
  userSub: string;
  tier: RulesChatTier;
  outcome: QuestionOutcome | `limited:${LimitReason}`;
  durationMs?: number;
  tokens?: TokenUsage;
}): void {
  console.info(`[RulesChat] question ${JSON.stringify(entry)}`);
}
