namespace RulesChat.Database.Entities;

// One rule in the index. ContentHash covers the rule file, the chunking version and the embedding model, so the index
// script can skip rules that haven't changed.
public sealed class IndexedRule
{
    public const int RuleUriMaxLength = 400;
    public const int RuleTitleMaxLength = 500;
    public const int ContentHashLength = 64;

    public required string RuleUri { get; init; }

    public required string RuleTitle { get; set; }

    public required string ContentHash { get; set; }

    public List<RuleChunk> Chunks { get; } = [];
}
