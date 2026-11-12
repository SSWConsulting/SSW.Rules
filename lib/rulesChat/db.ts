import sql from "mssql";
import { getRulesChatConfig } from "./config";

// The serverless database pauses after an hour unused. The first connection wakes it, which takes longer than one
// connection attempt allows, so the question that wakes it waits instead of failing.
// The chat route sends nothing until its usage check has connected, and App Service ends a request that sends nothing for
// 230 seconds. No attempt starts after this window, so the wait ends within it plus one attempt (15 seconds by default).
const WAKE_WAIT_MS = 2 * 60 * 1000;
const WAKE_POLL_MS = 5 * 1000;

// 40613 "Database ... is not currently available" means the database is resuming. A connection timeout usually means the
// same, but a network or firewall problem looks identical, so the log says both.
function wakeReason(error: unknown): string | null {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  if (typeof message === "string" && /\b40613\b|is not currently available/.test(message)) return "the database is resuming";
  if (code === "ETIMEOUT") return "the connection timed out, so the database may be resuming or a network or firewall problem may block it";
  return null;
}

export function isDatabaseWaking(error: unknown): boolean {
  return wakeReason(error) !== null;
}

async function connectWhileWaking(config: sql.config): Promise<sql.ConnectionPool> {
  const started = Date.now();
  const deadline = started + WAKE_WAIT_MS;
  for (;;) {
    const created = new sql.ConnectionPool(config);
    // Without a listener, a dropped connection would be thrown as an uncaught exception. A failed attempt's late error must
    // not drop the pool a later attempt connected.
    created.on("error", (error) => {
      console.error("[RulesChat] SQL pool error:", error);
      if (connected === created) {
        connected = undefined;
        pool = undefined;
      }
    });
    try {
      await created.connect();
      connected = created;
      return created;
    } catch (error) {
      created.close().catch((closeError) => console.error("[RulesChat] closing a failed SQL pool:", closeError));
      const reason = wakeReason(error);
      if (!reason) throw error;
      const waitedSeconds = Math.round((Date.now() - started) / 1000);
      if (Date.now() + WAKE_POLL_MS > deadline) {
        console.error(`[RulesChat] SQL connection failed after waiting ${waitedSeconds}s: ${reason}. Giving up.`);
        throw error;
      }
      console.warn(`[RulesChat] SQL connection failed after ${waitedSeconds}s: ${reason}. Connecting again in ${WAKE_POLL_MS / 1000}s.`);
      await new Promise((resolve) => setTimeout(resolve, WAKE_POLL_MS));
    }
  }
}

let pool: Promise<sql.ConnectionPool> | undefined;
let connected: sql.ConnectionPool | undefined;

export function getPool() {
  if (!pool) {
    pool = connectWhileWaking(getRulesChatConfig().sql).catch((error) => {
      pool = undefined;
      throw error;
    });
  }
  return pool;
}
