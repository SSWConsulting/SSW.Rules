using Microsoft.Data.SqlTypes;

namespace RulesChat.Database.Entities;

public sealed class RuleChunk
{
    public const int HeadingMaxLength = 500;

    // Every embedding model the site uses is configured to return this many dimensions.
    public const int EmbeddingDimensions = 1024;

    public int Id { get; init; }

    public required string RuleUri { get; init; }

    public required int ChunkIndex { get; init; }

    public required string Heading { get; init; }

    public required string Content { get; init; }

    public required SqlVector<float> Embedding { get; init; }
}
