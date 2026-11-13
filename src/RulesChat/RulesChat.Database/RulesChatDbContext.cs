using Microsoft.EntityFrameworkCore;
using RulesChat.Database.Entities;

namespace RulesChat.Database;

// Owns The Ruleferret's schema. The site and the index script (Node) read and write these tables with plain SQL, so a
// renamed table or column here must be renamed in scripts/rules-chat, lib/rulesChat and the grants in DatabaseAccess too.
public sealed class RulesChatDbContext(DbContextOptions<RulesChatDbContext> options) : DbContext(options)
{
    public DbSet<IndexedRule> IndexedRules => Set<IndexedRule>();

    public DbSet<RuleChunk> RuleChunks => Set<RuleChunk>();

    public DbSet<ChatUsage> ChatUsages => Set<ChatUsage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<IndexedRule>(rule =>
        {
            rule.HasKey(r => r.RuleUri);
            rule.Property(r => r.RuleUri).HasMaxLength(IndexedRule.RuleUriMaxLength);
            rule.Property(r => r.RuleTitle).HasMaxLength(IndexedRule.RuleTitleMaxLength);
            rule.Property(r => r.ContentHash).HasMaxLength(IndexedRule.ContentHashLength).IsFixedLength().IsUnicode(false);
            rule.HasMany(r => r.Chunks).WithOne().HasForeignKey(c => c.RuleUri);
        });

        modelBuilder.Entity<RuleChunk>(chunk =>
        {
            chunk.Property(c => c.RuleUri).HasMaxLength(IndexedRule.RuleUriMaxLength);
            chunk.Property(c => c.Heading).HasMaxLength(RuleChunk.HeadingMaxLength);
            chunk.Property(c => c.Embedding).HasColumnType($"vector({RuleChunk.EmbeddingDimensions})");
        });

        modelBuilder.Entity<ChatUsage>(usage =>
        {
            usage.ToTable("ChatUsage");
            usage.Property(u => u.UserSub).HasMaxLength(ChatUsage.UserSubMaxLength);
            usage.Property(u => u.Outcome).HasMaxLength(ChatUsage.OutcomeMaxLength).IsUnicode(false);
            usage.HasIndex(u => new { u.UserSub, u.StartedAt });
            usage.HasIndex(u => u.StartedAt);
        });

        // No cascades in the database: code that removes a rule removes its chunks first.
        foreach (var foreignKey in modelBuilder.Model.GetEntityTypes().SelectMany(entity => entity.GetForeignKeys()))
        {
            foreignKey.DeleteBehavior = DeleteBehavior.NoAction;
        }
    }
}
