using Microsoft.EntityFrameworkCore;

namespace RulesChat.Database;

// Gives each managed identity that signs in to the database a user with only the access it needs. The migrator runs
// this after the migrations, so a table that a migration recreates gets its grants back.
public static class DatabaseAccess
{
    // The site searches the index and records each question in ChatUsage. It never changes the index, so it isn't a
    // db_datawriter.
    public static async Task GrantSite(RulesChatDbContext db, string identityName, Guid identityClientId, CancellationToken cancellationToken)
    {
        await CreateUser(db, identityName, identityClientId, cancellationToken);
        await db.Database.ExecuteSqlAsync(
            $"""
            DECLARE @name SYSNAME = {identityName};
            DECLARE @user NVARCHAR(260) = QUOTENAME(@name);
            DECLARE @statement NVARCHAR(MAX);

            IF IS_ROLEMEMBER('db_datareader', @name) = 0
            BEGIN
              SET @statement = N'ALTER ROLE db_datareader ADD MEMBER ' + @user;
              EXEC (@statement);
            END
            IF IS_ROLEMEMBER('db_datawriter', @name) = 1
            BEGIN
              SET @statement = N'ALTER ROLE db_datawriter DROP MEMBER ' + @user;
              EXEC (@statement);
            END
            SET @statement = N'GRANT INSERT, UPDATE ON dbo.ChatUsage TO ' + @user;
            EXEC (@statement);
            """,
            cancellationToken);
    }

    // The index job only replaces rules in the index. It can't read ChatUsage, which holds GitHub user IDs.
    public static async Task GrantIndexJob(RulesChatDbContext db, string identityName, Guid identityClientId, CancellationToken cancellationToken)
    {
        await CreateUser(db, identityName, identityClientId, cancellationToken);
        await db.Database.ExecuteSqlAsync(
            $"""
            DECLARE @user NVARCHAR(260) = QUOTENAME({identityName});
            DECLARE @statement NVARCHAR(MAX);

            SET @statement = N'GRANT SELECT, INSERT, DELETE ON dbo.IndexedRules TO ' + @user;
            EXEC (@statement);
            SET @statement = N'GRANT SELECT, INSERT, DELETE ON dbo.RuleChunks TO ' + @user;
            EXEC (@statement);
            """,
            cancellationToken);
    }

    // CREATE USER ... WITH SID, TYPE = E needs no Microsoft Entra lookup, so the server needs no Graph permissions. SQL
    // can't check the ID either: a wrong client ID only shows up later, when the identity fails to sign in.
    private static async Task CreateUser(RulesChatDbContext db, string identityName, Guid identityClientId, CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlAsync(
            $"""
            DECLARE @name SYSNAME = {identityName};
            DECLARE @sid VARBINARY(85) = CONVERT(VARBINARY(16), {identityClientId});
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
            """,
            cancellationToken);
    }
}
