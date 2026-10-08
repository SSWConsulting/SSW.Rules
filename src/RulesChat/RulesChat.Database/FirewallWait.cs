using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace RulesChat.Database;

// The deploy opens a SQL firewall rule for its runner just before migrating, and Azure SQL can take up to five minutes
// to apply it. Until then, connections fail with error 40615.
public static class FirewallWait
{
    private const int FirewallBlockedErrorNumber = 40615;
    private static readonly TimeSpan MaxWait = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(15);

    public static async Task OpenConnection(RulesChatDbContext db, ILogger logger)
    {
        var deadline = DateTimeOffset.UtcNow + MaxWait;
        while (true)
        {
            try
            {
                await db.Database.OpenConnectionAsync();
                return;
            }
            catch (SqlException exception) when (exception.Number == FirewallBlockedErrorNumber && DateTimeOffset.UtcNow < deadline)
            {
                logger.LogInformation("The SQL firewall doesn't admit this machine yet; trying again in {Seconds}s", PollInterval.TotalSeconds);
                await Task.Delay(PollInterval);
            }
        }
    }
}
