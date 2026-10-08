import sql from "mssql";
import { getRulesChatConfig } from "./config";

let pool: Promise<sql.ConnectionPool> | undefined;

export function getPool() {
  if (!pool) {
    const created = new sql.ConnectionPool(getRulesChatConfig().sql);
    // Without a listener, a dropped connection would be thrown as an uncaught exception.
    created.on("error", (error) => {
      console.error("[RulesChat] SQL pool error:", error);
      pool = undefined;
    });
    pool = created.connect().catch((error) => {
      pool = undefined;
      throw error;
    });
  }
  return pool;
}
