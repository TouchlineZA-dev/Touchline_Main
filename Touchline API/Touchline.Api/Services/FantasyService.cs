using System.Security.Cryptography;
using System.Text.Json.Nodes;
using Touchline.Api.Infrastructure;
using Touchline.Api.Models;

namespace Touchline.Api.Services;

public sealed class FantasyService(SupabaseRestClient database, FantasyRules rules)
{
    public async Task<JsonObject> GetFantasyPlayersAsync(CancellationToken cancellationToken)
    {
        var season = await GetCurrentSeasonAsync(cancellationToken);
        var seasonId = season.Id;
        var playersTask = database.GetRowsAsync("football", "players", cancellationToken,
            ("select", "id,sportmonks_player_id,display_name,common_name,firstname,lastname,position_id,image_path,nationality_id"));
        var pricesTask = database.GetRowsAsync("app", "player_prices", cancellationToken,
            ("select", "player_id,price"), ("season_id", $"eq.{seasonId}"));
        var teamsTask = database.GetRowsAsync("football", "teams", cancellationToken,
            ("select", "id,name,short_code,image_path"));
        var fixturesTask = database.GetRowsAsync("football", "fixtures", cancellationToken,
            ("select", "id,starting_at"), ("season_id", $"eq.{seasonId}"));
        await Task.WhenAll(playersTask, pricesTask, teamsTask, fixturesTask);
        var players = playersTask.Result;
        var prices = pricesTask.Result;
        var teams = teamsTask.Result;
        var fixtures = fixturesTask.Result;

        var fixtureKickoffs = fixtures.ToDictionary(
            fixture => fixture?["id"]?.ToString() ?? "",
            fixture => DateTimeOffset.TryParse(fixture?["starting_at"]?.ToString(), out var kickoff)
                ? kickoff : DateTimeOffset.MinValue,
            StringComparer.Ordinal);
        var priceByPlayer = prices.ToDictionary(
            price => price?["player_id"]?.ToString() ?? "",
            price => decimal.TryParse(price?["price"]?.ToString(), out var amount) ? amount : 0m,
            StringComparer.Ordinal);
        var teamById = teams.ToDictionary(team => team?["id"]?.ToString() ?? "", StringComparer.Ordinal);
        var sportmonksIds = players.Select(player => player?["sportmonks_player_id"]?.ToString())
            .Where(id => !string.IsNullOrWhiteSpace(id)).Distinct(StringComparer.Ordinal).ToArray();
        var fixtureIds = fixtureKickoffs.Keys.Where(id => !string.IsNullOrWhiteSpace(id)).ToArray();

        var latestClub = new Dictionary<string, (string TeamId, DateTimeOffset Kickoff)>(StringComparer.Ordinal);
        if (fixtureIds.Length > 0 && sportmonksIds.Length > 0)
        {
            var fixtureFilter = $"in.({string.Join(',', fixtureIds)})";
            var playerFilter = $"in.({string.Join(',', sportmonksIds)})";
            var lineups = await database.GetRowsAsync("football", "player_lineups", cancellationToken,
                ("select", "sportmonks_player_id,team_id,fixture_id"),
                ("fixture_id", fixtureFilter), ("sportmonks_player_id", playerFilter));
            foreach (var lineup in lineups)
            {
                var playerId = lineup?["sportmonks_player_id"]?.ToString();
                var teamId = lineup?["team_id"]?.ToString();
                var fixtureId = lineup?["fixture_id"]?.ToString();
                if (playerId is null || teamId is null || fixtureId is null || !fixtureKickoffs.TryGetValue(fixtureId, out var kickoff)) continue;
                if (!latestClub.TryGetValue(playerId, out var current) || kickoff > current.Kickoff)
                    latestClub[playerId] = (teamId, kickoff);
            }
        }

        var result = new JsonArray();
        foreach (var player in players)
        {
            if (player is null) continue;
            var id = player["id"]?.ToString();
            var sportmonksId = player["sportmonks_player_id"]?.ToString();
            if (id is null || sportmonksId is null || !priceByPlayer.TryGetValue(id, out var price)) continue;
            latestClub.TryGetValue(sportmonksId, out var clubAssignment);
            teamById.TryGetValue(clubAssignment.TeamId ?? "", out var team);
            var positionId = player["position_id"]?.GetValue<int>() ?? 26;
            var fullName = string.Join(' ', new[] { player["firstname"]?.ToString(), player["lastname"]?.ToString() }
                .Where(value => !string.IsNullOrWhiteSpace(value)));
            var playerPayload = new JsonObject
            {
                ["id"] = long.Parse(id),
                ["sportmonksPlayerId"] = long.Parse(sportmonksId),
                ["name"] = player["display_name"]?.ToString() ?? player["common_name"]?.ToString() ??
                    (string.IsNullOrWhiteSpace(fullName) ? "Unknown player" : fullName),
                ["position"] = positionId switch { 24 => "GK", 25 => "DEF", 26 => "MID", 27 => "ATT", _ => "MID" },
                ["team"] = team?["name"]?.ToString(),
                ["teamId"] = long.TryParse(clubAssignment.TeamId, out var teamId) ? teamId : null,
                ["teamCrest"] = NormalizeImage(team?["image_path"]?.ToString()),
                ["imageUrl"] = NormalizeImage(player["image_path"]?.ToString()),
                ["nationalityId"] = player["nationality_id"]?.DeepClone(),
                ["price"] = price
            };
            foreach (var (key, value) in GetCardAttributes(long.Parse(id), positionId)) playerPayload[key] = value;
            result.Add(playerPayload);
        }
        return new JsonObject
        {
            ["season"] = new JsonObject { ["id"] = season.Id, ["name"] = season.Name },
            ["count"] = result.Count,
            ["players"] = result
        };
    }

    public async Task<JsonNode?> GetMyTeamAsync(Guid userId, CancellationToken cancellationToken)
    {
        var seasonId = await GetCurrentSeasonIdAsync(cancellationToken);
        var team = await FindTeamAsync(userId, seasonId, cancellationToken);
        if (team is null) return null;
        return await AddPicksAsync(team, seasonId, cancellationToken);
    }

    public async Task<JsonNode?> SaveTeamAsync(Guid userId, SaveFantasyTeamRequest request, CancellationToken cancellationToken)
    {
        rules.ValidateSquadShape(request);
        var seasonId = await GetCurrentSeasonIdAsync(cancellationToken);
        var picks = request.Picks.Select(pick => new Dictionary<string, object>
        {
            ["playerId"] = pick.PlayerId,
            ["slot"] = pick.Slot,
            ["isCaptain"] = pick.IsCaptain,
            ["isViceCaptain"] = pick.IsViceCaptain,
            ["isBench"] = pick.IsBench
        }).ToArray();

        await database.RpcAsync("app", "save_fantasy_team", new Dictionary<string, object>
        {
            ["p_user_id"] = userId,
            ["p_season_id"] = seasonId,
            ["p_team_name"] = request.TeamName.Trim(),
            ["p_formation"] = request.Formation,
            ["p_picks"] = picks
        }, cancellationToken);
        return await GetMyTeamAsync(userId, cancellationToken);
    }

    public async Task<JsonNode?> ActivateChipAsync(Guid userId, string chip, CancellationToken cancellationToken)
    {
        if (!FantasyRules.IsSupportedChip(chip)) throw new FantasyRuleException("Choose a supported fantasy chip.");
        var seasonId = await GetCurrentSeasonIdAsync(cancellationToken);
        return await database.RpcAsync("app", "activate_fantasy_chip", new Dictionary<string, object>
        {
            ["p_user_id"] = userId,
            ["p_season_id"] = seasonId,
            ["p_chip"] = chip
        }, cancellationToken);
    }

    public async Task<JsonNode?> GetOtherTeamAsync(Guid ownerUserId, CancellationToken cancellationToken)
    {
        var seasonId = await GetCurrentSeasonIdAsync(cancellationToken);
        var team = await FindTeamAsync(ownerUserId, seasonId, cancellationToken);
        return team is null ? null : await AddPicksAsync(team, seasonId, cancellationToken);
    }

    public async Task<JsonNode?> CreateLeagueAsync(Guid userId, string name, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 50)
            throw new FantasyRuleException("League name must be between 1 and 50 characters.");
        var seasonId = await GetCurrentSeasonIdAsync(cancellationToken);
        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(4));
        return await database.RpcAsync("app", "create_fantasy_league", new Dictionary<string, object>
        {
            ["p_user_id"] = userId,
            ["p_season_id"] = seasonId,
            ["p_name"] = name.Trim(),
            ["p_join_code"] = code
        }, cancellationToken);
    }

    public async Task<JsonNode?> JoinLeagueAsync(Guid userId, string code, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Trim().Length != 8)
            throw new FantasyRuleException("Enter the 8-character league code.");
        return await database.RpcAsync("app", "join_fantasy_league", new Dictionary<string, object>
        {
            ["p_user_id"] = userId,
            ["p_join_code"] = code.Trim().ToUpperInvariant()
        }, cancellationToken);
    }

    public async Task<JsonArray> GetMyLeaguesAsync(Guid userId, CancellationToken cancellationToken)
    {
        var seasonId = await GetCurrentSeasonIdAsync(cancellationToken);
        var memberships = await database.GetRowsAsync("app", "fantasy_league_members", cancellationToken,
            ("select", "league_id"), ("auth_user_id", $"eq.{userId}"));
        var result = new JsonArray();
        foreach (var membership in memberships)
        {
            if (membership is null) continue;
            var leagueId = membership["league_id"]?.GetValue<string>();
            if (leagueId is null) continue;
            var leagues = await database.GetRowsAsync("app", "fantasy_leagues", cancellationToken,
                ("select", "id,name,season_id,owner_auth_user_id,join_code,created_at"),
                ("id", $"eq.{leagueId}"), ("season_id", $"eq.{seasonId}"));
            if (leagues.Count == 0 || leagues[0] is not JsonObject league) continue;
            var isOwner = league["owner_auth_user_id"]?.ToString() == userId.ToString();
            result.Add(new JsonObject
            {
                ["id"] = league["id"]?.DeepClone(),
                ["name"] = league["name"]?.DeepClone(),
                ["seasonId"] = league["season_id"]?.DeepClone(),
                ["isOwner"] = isOwner,
                ["joinCode"] = isOwner ? league["join_code"]?.DeepClone() : null,
                ["createdAt"] = league["created_at"]?.DeepClone()
            });
        }
        return result;
    }

    public async Task<JsonNode?> GetLeagueAsync(Guid userId, Guid leagueId, CancellationToken cancellationToken)
    {
        var seasonId = await GetCurrentSeasonIdAsync(cancellationToken);
        await RequireLeagueMemberAsync(userId, leagueId, cancellationToken);
        var leagues = await database.GetRowsAsync("app", "fantasy_leagues", cancellationToken,
            ("select", "id,name,season_id,created_at"),
            ("id", $"eq.{leagueId}"), ("season_id", $"eq.{seasonId}"));
        if (leagues.Count == 0) return null;

        var members = await database.GetRowsAsync("app", "fantasy_league_members", cancellationToken,
            ("select", "team_id"), ("league_id", $"eq.{leagueId}"));
        var teams = new JsonArray();
        foreach (var member in members)
        {
            if (member is null) continue;
            var teamId = member["team_id"]?.GetValue<string>();
            if (teamId is null) continue;
            var rows = await database.GetRowsAsync("app", "fantasy_teams", cancellationToken,
                ("select", "id,team_name,formation,total_points,gameweek_points"), ("id", $"eq.{teamId}"));
            if (rows.Count > 0 && rows[0] is JsonObject team)
            {
                teams.Add(new JsonObject
                {
                    ["teamId"] = team["id"]?.DeepClone(),
                    ["teamName"] = team["team_name"]?.DeepClone(),
                    ["formation"] = team["formation"]?.DeepClone(),
                    ["totalPoints"] = team["total_points"]?.DeepClone(),
                    ["gameweekPoints"] = team["gameweek_points"]?.DeepClone()
                });
            }
        }
        var storedLeague = leagues[0]!.AsObject();
        var result = new JsonObject
        {
            ["id"] = storedLeague["id"]?.DeepClone(),
            ["name"] = storedLeague["name"]?.DeepClone(),
            ["seasonId"] = storedLeague["season_id"]?.DeepClone(),
            ["createdAt"] = storedLeague["created_at"]?.DeepClone(),
            ["members"] = teams
        };
        return result;
    }

    public async Task<JsonArray> GetLeagueStandingsAsync(Guid userId, Guid leagueId, int? gameweek, CancellationToken cancellationToken)
    {
        if (gameweek is < 1) throw new FantasyRuleException("Gameweek must be a positive number.");
        await RequireLeagueMemberAsync(userId, leagueId, cancellationToken);
        var memberships = await database.GetRowsAsync("app", "fantasy_league_members", cancellationToken,
            ("select", "team_id"), ("league_id", $"eq.{leagueId}"));
        var teams = new List<(string Id, string Name, int Total, int Week)>();
        foreach (var membership in memberships)
        {
            if (membership is null) continue;
            var teamId = membership["team_id"]?.GetValue<string>();
            if (teamId is null) continue;
            var rows = await database.GetRowsAsync("app", "fantasy_teams", cancellationToken,
                ("select", "id,team_name,total_points,gameweek_points"), ("id", $"eq.{teamId}"));
            if (rows.Count == 0) continue;
            var team = rows[0]!;
            var weekPoints = team["gameweek_points"]?.GetValue<int>() ?? 0;
            if (gameweek.HasValue)
            {
                var scoreRows = await database.GetRowsAsync("app", "fantasy_gameweek_scores", cancellationToken,
                    ("select", "points"), ("team_id", $"eq.{teamId}"), ("gameweek", $"eq.{gameweek.Value}"));
                weekPoints = scoreRows.FirstOrDefault()?["points"]?.GetValue<int>() ?? 0;
            }
            teams.Add((teamId, team["team_name"]?.GetValue<string>() ?? "Fantasy team",
                team["total_points"]?.GetValue<int>() ?? 0, weekPoints));
        }

        var ranked = gameweek.HasValue
            ? teams.OrderByDescending(team => team.Week).ThenByDescending(team => team.Total).ThenBy(team => team.Name)
            : teams.OrderByDescending(team => team.Total).ThenBy(team => team.Name);
        var output = new JsonArray();
        var rank = 1;
        foreach (var team in ranked)
        {
            output.Add(new JsonObject
            {
                ["rank"] = rank++, ["teamId"] = team.Id, ["teamName"] = team.Name,
                ["gameweekPoints"] = team.Week, ["totalPoints"] = team.Total
            });
        }
        return output;
    }

    private async Task RequireLeagueMemberAsync(Guid userId, Guid leagueId, CancellationToken cancellationToken)
    {
        var rows = await database.GetRowsAsync("app", "fantasy_league_members", cancellationToken,
            ("select", "league_id"), ("league_id", $"eq.{leagueId}"), ("auth_user_id", $"eq.{userId}"));
        if (rows.Count == 0) throw new FantasyAccessException("Join this league to view its members and standings.");
    }

    private async Task<JsonObject?> FindTeamAsync(Guid ownerId, long seasonId, CancellationToken cancellationToken)
    {
        var rows = await database.GetRowsAsync("app", "fantasy_teams", cancellationToken,
            ("select", "*"), ("owner_auth_user_id", $"eq.{ownerId}"),
            ("season_id", $"eq.{seasonId}"), ("limit", "1"));
        return rows.FirstOrDefault()?.AsObject().DeepClone().AsObject();
    }

    private async Task<JsonNode> AddPicksAsync(JsonObject team, long seasonId, CancellationToken cancellationToken)
    {
        var teamId = team["id"]?.GetValue<string>() ?? throw new InvalidOperationException("Stored team has no ID.");
        var picks = await database.GetRowsAsync("app", "fantasy_team_picks", cancellationToken,
            ("select", "player_id,slot,is_captain,is_vice_captain,is_bench"),
            ("team_id", $"eq.{teamId}"), ("order", "slot.asc"));
        var catalog = await GetFantasyPlayersAsync(cancellationToken);
        var players = catalog["players"]?.AsArray()
            .Where(player => player is not null)
            .ToDictionary(player => player!["id"]?.ToString() ?? "", player => player!, StringComparer.Ordinal)
            ?? new Dictionary<string, JsonNode>(StringComparer.Ordinal);
        var outputPicks = new JsonArray();
        foreach (var pick in picks)
        {
            if (pick is null) continue;
            var playerId = pick["player_id"]?.GetValue<long>();
            JsonObject? playerDto = null;
            if (playerId.HasValue)
            {
                if (players.TryGetValue(playerId.Value.ToString(), out var player))
                    playerDto = player.DeepClone().AsObject();
            }
            outputPicks.Add(new JsonObject
            {
                ["playerId"] = playerId,
                ["slot"] = pick["slot"]?.DeepClone(),
                ["isCaptain"] = pick["is_captain"]?.DeepClone(),
                ["isViceCaptain"] = pick["is_vice_captain"]?.DeepClone(),
                ["isBench"] = pick["is_bench"]?.DeepClone(),
                ["player"] = playerDto
            });
        }
        return ShapeTeam(team, seasonId, outputPicks);
    }

    private static JsonObject ShapeTeam(JsonObject team, long seasonId, JsonArray picks) => new()
    {
        ["id"] = team["id"]?.DeepClone(),
        ["userId"] = team["owner_auth_user_id"]?.DeepClone(),
        ["seasonId"] = seasonId,
        ["teamName"] = team["team_name"]?.DeepClone(),
        ["formation"] = team["formation"]?.DeepClone(),
        ["budgetRemaining"] = team["budget_remaining"]?.DeepClone(),
        ["totalPoints"] = team["total_points"]?.DeepClone(),
        ["gameweekPoints"] = team["gameweek_points"]?.DeepClone(),
        ["activeChip"] = team["active_chip"]?.DeepClone(),
        ["usedChips"] = team["used_chips"]?.DeepClone(),
        ["updatedAt"] = team["updated_at"]?.DeepClone(),
        ["picks"] = picks
    };

    private async Task<long> GetCurrentSeasonIdAsync(CancellationToken cancellationToken)
    {
        return (await GetCurrentSeasonAsync(cancellationToken)).Id;
    }

    private async Task<(long Id, string Name)> GetCurrentSeasonAsync(CancellationToken cancellationToken)
    {
        var competitions = await database.GetRowsAsync("football", "competitions", cancellationToken,
            ("select", "id"), ("sportmonks_competition_id", "eq.806"), ("limit", "1"));
        var competitionId = competitions.FirstOrDefault()?["id"]?.GetValue<long>();
        if (!competitionId.HasValue) throw new InvalidOperationException("PSL competition is not configured in Supabase.");

        var seasons = await database.GetRowsAsync("football", "seasons", cancellationToken,
            ("select", "id,name"), ("competition_id", $"eq.{competitionId.Value}"),
            ("is_current", "eq.true"), ("limit", "1"));
        var current = seasons.FirstOrDefault();
        var id = current?["id"]?.GetValue<long>()
            ?? throw new InvalidOperationException("No current PSL season is configured in Supabase.");
        return (id, current?["name"]?.GetValue<string>() ?? "Current season");
    }

    private static string? NormalizeImage(string? imageUrl) =>
        string.IsNullOrWhiteSpace(imageUrl) || imageUrl.Contains("placeholder", StringComparison.OrdinalIgnoreCase)
            ? null : imageUrl;

    private static IReadOnlyDictionary<string, int> GetCardAttributes(long playerId, int positionId)
    {
        var rating = 68 + (int)Math.Floor(Seeded(playerId, 1) * 14);
        int Spread(int salt, double low, double high) =>
            Math.Clamp((int)Math.Round(rating * (low + Seeded(playerId, salt) * (high - low))), 20, 99);

        return positionId switch
        {
            24 => new Dictionary<string, int>
            {
                ["rating"] = rating, ["pace"] = Spread(2, .45, .6), ["shooting"] = Spread(3, .2, .3),
                ["passing"] = Spread(4, .6, .8), ["defending"] = Spread(5, .9, 1.05),
                ["dribbling"] = Spread(6, .35, .5), ["physical"] = Spread(7, .75, .9)
            },
            25 => new Dictionary<string, int>
            {
                ["rating"] = rating, ["pace"] = Spread(2, .75, .9), ["shooting"] = Spread(3, .35, .5),
                ["passing"] = Spread(4, .65, .8), ["defending"] = Spread(5, .88, 1.02),
                ["dribbling"] = Spread(6, .55, .7), ["physical"] = Spread(7, .8, .95)
            },
            26 => new Dictionary<string, int>
            {
                ["rating"] = rating, ["pace"] = Spread(2, .75, .92), ["shooting"] = Spread(3, .65, .85),
                ["passing"] = Spread(4, .85, 1.0), ["defending"] = Spread(5, .6, .78),
                ["dribbling"] = Spread(6, .8, .98), ["physical"] = Spread(7, .65, .82)
            },
            _ => new Dictionary<string, int>
            {
                ["rating"] = rating, ["pace"] = Spread(2, .85, 1.0), ["shooting"] = Spread(3, .85, 1.0),
                ["passing"] = Spread(4, .65, .82), ["defending"] = Spread(5, .3, .45),
                ["dribbling"] = Spread(6, .82, .98), ["physical"] = Spread(7, .68, .85)
            }
        };
    }

    private static double Seeded(long seed, int salt)
    {
        var hash = unchecked((uint)(seed * 2654435761L + salt * 40503L));
        hash ^= hash >> 15;
        hash = unchecked(hash * 2246822507u);
        hash ^= hash >> 13;
        return hash / 4294967296d;
    }
}

public sealed class FantasyAccessException(string message) : Exception(message);
