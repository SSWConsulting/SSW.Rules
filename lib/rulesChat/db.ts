import sql from "mssql";
import { getRulesChatConfig } from "./config";

// The serverless database pauses after an hour unused. The first connection wakes it, which takes longer than one
// connection attempt allows, so the question that wakes it waits instead of failing.
const WAKE_WAIT_MS = 2 * 60 * 1000;
const WAKE_POLL_MS = 5 * 1000;

// A connection timeout, or 40613 "Database ... is not currently available", while the database resumes.
export function isDatabaseWaking(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return code === "ETIMEOUT" || (typeof message === "string" && /\b40613\b|is not currently available/.test(message));
}

async function connectWhileWaking(config: sql.config): Promise<sql.ConnectionPool> {
  const deadline = Date.now() + WAKE_WAIT_MS;
  for (;;) {
    const created = new sql.ConnectionPool(config);
    // Without a listener, a dropped connection would be thrown as an uncaught exception.
    created.on("error", (error) => {
      console.error("[RulesChat] SQL pool error:", error);
      pool = undefined;
    });
    try {
      return await created.connect();
    } catch (error) {
      if (!isDatabaseWaking(error) || Date.now() > deadline) throw error;
      console.warn("[RulesChat] the database is resuming; connecting again in 5s");
      await new Promise((resolve) => setTimeout(resolve, WAKE_POLL_MS));
    }
  }
}

let pool: Promise<sql.ConnectionPool> | undefined;

export function getPool() {
  if (!pool) {
    pool = connectWhileWaking(getRulesChatConfig().sql).catch((error) => {
      pool = undefined;
      throw error;
    });
  }
  return pool;
}
