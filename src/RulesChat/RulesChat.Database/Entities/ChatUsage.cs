namespace RulesChat.Database.Entities;

// One row per question asked, with no question or answer text. Backs the per-user and monthly limits; the index script
// deletes rows older than 90 days.
public sealed class ChatUsage
{
    public const int UserSubMaxLength = 200;
    public const int OutcomeMaxLength = 20;

    public long Id { get; init; }

    public required string UserSub { get; init; }

    public required bool IsStaff { get; init; }

    public required DateTime StartedAt { get; init; }

    public DateTime? FinishedAt { get; set; }

    // A QuestionOutcome from lib/rulesChat/usage.ts, or "limited:" plus the LimitReason that refused the question.
    public string? Outcome { get; set; }

    public int? InputTokens { get; set; }

    public int? OutputTokens { get; set; }
}
