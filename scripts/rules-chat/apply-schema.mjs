// Creates or updates the Rules Chat tables. Safe to run on every deploy and on a fresh local SQL Server.
//
//   pnpm rules-chat:schema
//
// With RULES_CHAT_SITE_IDENTITY_NAME and RULES_CHAT_SITE_IDENTITY_CLIENT_ID set (the deploy pipeline sets them), it also
// gives the site's managed identity a database user that can read and write the tables.

import sql from "mssql";
import { applySchema, connect, ensureLocalDatabase, loadEnv } from "./sql.mjs";

// CREATE USER ... WITH SID, TYPE = E needs no Microsoft Entra lookup, so the server needs no Graph permissions. SQL
// can't check the ID either: a wrong client ID only shows up later, when the site fails to sign in.
const GRANT_SITE_ACCESS = `
  DECLARE @sid VARBINARY(85) = CONVERT(VARBINARY(16), CONVERT(UNIQUEIDENTIFIER, @clientId));
  DECLARE @existingSid VARBINARY(85) = (SELECT sid FROM sys.database_principals WHERE name = @name);
  DECLARE @user NVARCHAR(260) = QUOTENAME(@name);
  DECLARE @statement NVARCHAR(MAX);

  -- A recreated identity has a new client ID, so its old user can no longer sign in.
  IF @existingSid IS NOT NULL AND @existingSid <> @sid
  BEGIN
    SET @statement = N'DROP USER ' + @user;
    EXEC (@statement);
  END
  IF USER_ID(@name) IS NULL
  BEGIN
    SET @statement = N'CREATE USER ' + @user + N' WITH SID = ' + CONVERT(NVARCHAR(MAX), @sid, 1) + N', TYPE = E';
    EXEC (@statement);
  END
  IF IS_ROLEMEMBER('db_datareader', @name) = 0
  BEGIN
    SET @statement = N'ALTER ROLE db_datareader ADD MEMBER ' + @user;
    EXEC (@statement);
  END
  IF IS_ROLEMEMBER('db_datawriter', @name) = 0
  BEGIN
    SET @statement = N'ALTER ROLE db_datawriter ADD MEMBER ' + @user;
    EXEC (@statement);
  END`;

async function grantSiteAccess(pool, name, clientId) {
  await pool.request().input("name", sql.NVarChar(128), name).input("clientId", sql.NVarChar(36), clientId).query(GRANT_SITE_ACCESS);
  console.log(`Gave ${name} (client ID ${clientId}) read and write access`);
}

async function main() {
  loadEnv();
  const identityName = process.env.RULES_CHAT_SITE_IDENTITY_NAME;
  const identityClientId = process.env.RULES_CHAT_SITE_IDENTITY_CLIENT_ID;
  if (Boolean(identityName) !== Boolean(identityClientId)) {
    throw new Error("Set both RULES_CHAT_SITE_IDENTITY_NAME and RULES_CHAT_SITE_IDENTITY_CLIENT_ID, or neither.");
  }

  await ensureLocalDatabase();
  const pool = await connect();
  try {
    await applySchema(pool);
    if (identityName) await grantSiteAccess(pool, identityName, identityClientId);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
