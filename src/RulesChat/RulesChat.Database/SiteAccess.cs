using Microsoft.EntityFrameworkCore;

namespace RulesChat.Database;

// Gives the site's managed identity a database user that can read and write the tables.
public static class SiteAccess
{
    public static async Task Grant(RulesChatDbContext db, string identityName, Guid identityClientId, CancellationToken cancellationToken)
    {
        // CREATE USER ... WITH SID, TYPE = E needs no Microsoft Entra lookup, so the server needs no Graph permissions. SQL
        // can't check the ID either: a wrong client ID only shows up later, when the site fails to sign in.
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
            IF IS_ROLEMEMBER('db_datareader', @name) = 0
            BEGIN
              SET @statement = N'ALTER ROLE db_datareader ADD MEMBER ' + @user;
              EXEC (@statement);
            END
            IF IS_ROLEMEMBER('db_datawriter', @name) = 0
            BEGIN
              SET @statement = N'ALTER ROLE db_datawriter ADD MEMBER ' + @user;
              EXEC (@statement);
            END
            """,
            cancellationToken);
    }
}
