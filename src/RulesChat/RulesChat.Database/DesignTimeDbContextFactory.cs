using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RulesChat.Database;

// Lets dotnet ef add migrations without a database. Commands that connect (database update) need a real connection
// string passed with --connection.
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<RulesChatDbContext>
{
    public RulesChatDbContext CreateDbContext(string[] args)
    {
        DbContextOptionsBuilder<RulesChatDbContext> options = new();
        RulesChatDatabase.Configure(options, "Server=localhost;Database=RulesChat");
        return new RulesChatDbContext(options.Options);
    }
}
