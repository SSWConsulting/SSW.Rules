using Microsoft.EntityFrameworkCore;

namespace RulesChat.Database;

public static class RulesChatDatabase
{
    // The vector type needs SQL Server 2025's compatibility level, which Azure SQL Database also accepts.
    private const int SqlServer2025CompatibilityLevel = 170;

    public static void Configure(DbContextOptionsBuilder options, string connectionString) =>
        options.UseSqlServer(connectionString, sql => sql.UseCompatibilityLevel(SqlServer2025CompatibilityLevel));
}
