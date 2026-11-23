using Touchline.Api.Models;

namespace Touchline.Api.Services;

/// <summary>Authoritative scoring rules. The sync service supplies match data;
/// this service scores only the events passed for completed, valid fixtures.</summary>
public sealed class FantasyScoringService
{
    public PlayerScoreBreakdown ScorePlayer(PlayerMatchEvent matchEvent, string position,
        bool isCaptain, bool isViceCaptain, string? activeChip)
    {
        var halfPlayed = matchEvent.MinutesPlayed >= 45 ? 1 : 0;
        var fullMatch = matchEvent.MinutesPlayed >= 90 ? 1 : 0;
        var goals = matchEvent.Goals * 3;
        var assists = matchEvent.Assists * 2;
        var cleanSheet = matchEvent.CleanSheet && position is "GK" or "DEF" ? 2 : 0;
        var basePoints = halfPlayed + fullMatch + goals + assists + cleanSheet;
        var multiplier = isCaptain ? (activeChip == "triple_captain" ? 9 : 3) : isViceCaptain ? 2 : 1;
        return new PlayerScoreBreakdown(halfPlayed, fullMatch, goals, assists,
            cleanSheet, basePoints, multiplier, basePoints * multiplier);
    }

    public FantasyGameweekScore ScoreTeam(IReadOnlyCollection<FantasyPickForScoring> picks,
        IReadOnlyDictionary<long, PlayerMatchEvent> events, string? activeChip)
    {
        var scores = new Dictionary<long, PlayerScoreBreakdown>();
        var total = 0;
        foreach (var pick in picks)
        {
            var matchEvent = events.TryGetValue(pick.PlayerId, out var found)
                ? found : new PlayerMatchEvent(0, 0, 0, false);
            var score = ScorePlayer(matchEvent, pick.Position, pick.IsCaptain, pick.IsViceCaptain, activeChip);
            scores[pick.PlayerId] = score;
            if (!pick.IsBench || activeChip == "bench_boost") total += score.FinalPoints;
        }
        return new FantasyGameweekScore(total, scores);
    }
}
