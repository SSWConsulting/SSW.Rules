// Settings and SQL connection shared by the Rules Chat scripts. The tables themselves are defined by the EF Core
// migrations in src/RulesChat/RulesChat.Database.

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";

export const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function loadEnv() {
  for (const envFile of [".env.local", ".env"]) {
    const path = join(siteRoot, envFile);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  return value;
}

// A password means the local SQL Server that Aspire runs in Docker. Without one, Azure SQL is reached with Microsoft Entra: the managed
// identity whose client ID is in RULES_CHAT_IDENTITY_CLIENT_ID on Azure, or the signed-in Azure CLI in the pipeline.
function sqlConfig() {
  const database = requireEnv("RULES_CHAT_SQL_DATABASE");
  const server = requireEnv("RULES_CHAT_SQL_SERVER");
  const port = Number(process.env.RULES_CHAT_SQL_PORT || 1433);
  const password = process.env.RULES_CHAT_SQL_PASSWORD;
  if (password) {
    return {
      server,
      port,
      database,
      user: requireEnv("RULES_CHAT_SQL_USER"),
      password,
      // Only a local SQL Server with a self-signed certificate should opt in to trusting it.
      options: { encrypt: true, trustServerCertificate: process.env.RULES_CHAT_SQL_TRUST_CERTIFICATE === "true" },
    };
  }
  return {
    server,
    port,
    database,
    authentication: { type: "azure-active-directory-default", options: { clientId: process.env.RULES_CHAT_IDENTITY_CLIENT_ID || undefined } },
    options: { encrypt: true },
  };
}

// A firewall rule opened just before connecting can take up to five minutes to apply on Azure SQL.
const FIREWALL_WAIT_MS = 5 * 60 * 1000;
const FIREWALL_POLL_MS = 15 * 1000;

export async function connect(poolOptions) {
  const deadline = Date.now() + FIREWALL_WAIT_MS;
  for (;;) {
    try {
      return await new sql.ConnectionPool({ ...sqlConfig(), ...(poolOptions ? { pool: poolOptions } : {}) }).connect();
    } catch (error) {
      const blockedByFirewall = /is not allowed to access the server/.test(error.message);
      if (!blockedByFirewall || Date.now() > deadline) throw error;
      console.log("The SQL firewall doesn't admit this machine yet; trying again in 15s");
      await new Promise((resolveDelay) => setTimeout(resolveDelay, FIREWALL_POLL_MS));
    }
  }
}
