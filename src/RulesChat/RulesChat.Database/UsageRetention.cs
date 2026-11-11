using Microsoft.EntityFrameworkCore;

namespace RulesChat.Database;

// Usage rows hold GitHub user IDs and only back the limits and support questions, which never look back further than
// this. The migrator runs on every deploy, so old rows go at least that often.
public static class UsageRetention
{
    public const int RetentionDays = 90;

    public static Task<int> DeleteOldRows(RulesChatDbContext db, CancellationToken cancellationToken)
    {
        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        return db.ChatUsages.Where(usage => usage.StartedAt < cutoff).ExecuteDeleteAsync(cancellationToken);
    }
}
