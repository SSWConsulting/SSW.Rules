// Brings The Ruleferret's database up to date: applies any pending EF Core migrations, then, when the deploy pipeline
// passes the managed identities of the site and the index job, gives each one its access. Safe to run on every deploy
// and every local start.
//
// Configuration (environment variables):
//   ConnectionStrings__RulesChat             the database; Aspire sets it locally, the deploy pipeline on Azure
//   RULES_CHAT_SITE_IDENTITY_NAME            optional, with the client ID: the site's managed identity
//   RULES_CHAT_SITE_IDENTITY_CLIENT_ID
//   RULES_CHAT_INDEX_JOB_IDENTITY_NAME       optional, with the client ID: the index job's managed identity
//   RULES_CHAT_INDEX_JOB_IDENTITY_CLIENT_ID

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RulesChat.Database;

var builder = Host.CreateApplicationBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("RulesChat")
    ?? throw new InvalidOperationException("ConnectionStrings__RulesChat is not set.");
builder.Services.AddDbContext<RulesChatDbContext>(options => RulesChatDatabase.Configure(options, connectionString));

var siteIdentity = ReadIdentity(builder.Configuration, "RULES_CHAT_SITE_IDENTITY");
var indexJobIdentity = ReadIdentity(builder.Configuration, "RULES_CHAT_INDEX_JOB_IDENTITY");

using var host = builder.Build();
var logger = host.Services.GetRequiredService<ILoggerFactory>().CreateLogger("RulesChat.Database");
await using var scope = host.Services.CreateAsyncScope();
var db = scope.ServiceProvider.GetRequiredService<RulesChatDbContext>();

await FirewallWait.OpenConnection(db, logger);
var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
await db.Database.MigrateAsync();
logger.LogInformation("Applied {Count} migrations: {Migrations}", pending.Count, pending.Count == 0 ? "none pending" : string.Join(", ", pending));

var deleted = await UsageRetention.DeleteOldRows(db, CancellationToken.None);
logger.LogInformation("Deleted {Count} chat usage rows older than {Days} days", deleted, UsageRetention.RetentionDays);

if (siteIdentity is { } site)
{
    await DatabaseAccess.GrantSite(db, site.Name, site.ClientId, CancellationToken.None);
    logger.LogInformation("Gave the site's identity {Identity} (client ID {ClientId}) its access", site.Name, site.ClientId);
}

if (indexJobIdentity is { } indexJob)
{
    await DatabaseAccess.GrantIndexJob(db, indexJob.Name, indexJob.ClientId, CancellationToken.None);
    logger.LogInformation("Gave the index job's identity {Identity} (client ID {ClientId}) its access", indexJob.Name, indexJob.ClientId);
}

static (string Name, Guid ClientId)? ReadIdentity(IConfiguration configuration, string prefix)
{
    var name = configuration[$"{prefix}_NAME"];
    var clientId = configuration[$"{prefix}_CLIENT_ID"];
    if (string.IsNullOrEmpty(name) && string.IsNullOrEmpty(clientId))
    {
        return null;
    }
    if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(clientId))
    {
        throw new InvalidOperationException($"Set both {prefix}_NAME and {prefix}_CLIENT_ID, or neither.");
    }
    if (!Guid.TryParse(clientId, out var parsed))
    {
        throw new InvalidOperationException($"{prefix}_CLIENT_ID must be a GUID, not \"{clientId}\".");
    }
    return (name, parsed);
}
