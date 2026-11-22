namespace Touchline.Api.Models;

public sealed record PlayerMatchEvent(
    int MinutesPlayed,
    int Goals,
    int Assists,
    bool CleanSheet);

public sealed record PlayerScoreBreakdown(
    int HalfPlayedPoints,
    int FullMatchPoints,
    int GoalPoints,
    int AssistPoints,
    int CleanSheetPoints,
    int BasePoints,
    int Multiplier,
    int FinalPoints);

public sealed record FantasyPickForScoring(
    long PlayerId,
    string Position,
    bool IsCaptain,
    bool IsViceCaptain,
    bool IsBench);

public sealed record FantasyGameweekScore(
    int TotalPoints,
    IReadOnlyDictionary<long, PlayerScoreBreakdown> PlayerScores);
