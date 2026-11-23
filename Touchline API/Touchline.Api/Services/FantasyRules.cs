using Touchline.Api.Models;

namespace Touchline.Api.Services;

public sealed class FantasyRules
{
    public const decimal SquadBudget = 300.0m;
    public const int SquadSize = 15;
    public const int MaxPlayersPerClub = 3;
    public const int MiniLeagueMaxMembers = 20;

    private static readonly IReadOnlyDictionary<string, (int Defenders, int Midfielders, int Attackers)> Formations =
        new Dictionary<string, (int, int, int)>
        {
            ["4-4-2"] = (4, 4, 2),
            ["4-3-3"] = (4, 3, 3),
            ["3-5-2"] = (3, 5, 2),
            ["3-4-3"] = (3, 4, 3),
            ["5-3-2"] = (5, 3, 2)
        };

    public void ValidateSquadShape(SaveFantasyTeamRequest request)
    {
        if (!Formations.TryGetValue(request.Formation, out var formation))
            throw new FantasyRuleException("Choose a supported formation.");
        if (request.Picks.Count != SquadSize)
            throw new FantasyRuleException("A squad must contain exactly 15 players.");
        if (request.Picks.Select(pick => pick.PlayerId).Distinct().Count() != SquadSize)
            throw new FantasyRuleException("A player cannot appear more than once in the squad.");
        if (!request.Picks.Select(pick => pick.Slot).Order().SequenceEqual(Enumerable.Range(0, SquadSize)))
            throw new FantasyRuleException("Use each squad slot from 0 to 14 exactly once.");
        if (request.Picks.Any(pick => pick.IsBench != (pick.Slot >= 11)))
            throw new FantasyRuleException("Slots 0–10 are starters; slots 11–14 are the bench.");
        if (request.Picks.Count(pick => pick.IsCaptain) != 1 || request.Picks.Count(pick => pick.IsViceCaptain) != 1)
            throw new FantasyRuleException("Choose one captain and one vice-captain.");
        if (request.Picks.Any(pick => pick.IsCaptain && pick.IsViceCaptain))
            throw new FantasyRuleException("Captain and vice-captain must be different players.");
        if (request.Picks.Any(pick => (pick.IsCaptain || pick.IsViceCaptain) && pick.IsBench))
            throw new FantasyRuleException("Captain and vice-captain must be starters.");
    }

    public static bool IsSupportedChip(string chip) =>
        chip is "bench_boost" or "triple_captain" or "wildcard";
}

public sealed class FantasyRuleException(string message) : Exception(message);
