// Brings The Rulekeeper's database up to date: applies any pending EF Core migrations, then, when the deploy pipeline
// passes the site's managed identity, gives it access. Safe to run on every deploy and every local start.
//
// Configuration (environment variables):
//   ConnectionStrings__RulesChat         the database; Aspire sets it locally, the deploy pipeline on Azure
//   RULES_CHAT_SITE_IDENTITY_NAME        optional, with the client ID: the managed identity to give access
//   RULES_CHAT_SITE_IDENTITY_CLIENT_ID

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

var identityName = builder.Configuration["RULES_CHAT_SITE_IDENTITY_NAME"];
var identityClientId = builder.Configuration["RULES_CHAT_SITE_IDENTITY_CLIENT_ID"];
if (string.IsNullOrEmpty(identityName) != string.IsNullOrEmpty(identityClientId))
{
    throw new InvalidOperationException("Set both RULES_CHAT_SITE_IDENTITY_NAME and RULES_CHAT_SITE_IDENTITY_CLIENT_ID, or neither.");
}

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

if (!string.IsNullOrEmpty(identityName))
{
    if (!Guid.TryParse(identityClientId, out var clientId))
    {
        throw new InvalidOperationException($"RULES_CHAT_SITE_IDENTITY_CLIENT_ID must be a GUID, not \"{identityClientId}\".");
    }

    await SiteAccess.Grant(db, identityName, clientId, CancellationToken.None);
    logger.LogInformation("Gave {Identity} (client ID {ClientId}) read and write access", identityName, clientId);
}
