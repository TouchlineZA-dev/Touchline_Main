using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Touchline.Api.Business;
using Touchline.Api.Data;
using Touchline.Api.Fantasy;
using Touchline.Api.Models;
using Touchline.Api.Users;

namespace Touchline.Api.Services;

/// <summary>Persists fantasy state in the app schema. Football data is read-only.</summary>
public sealed class FantasyService(
    TouchlineDbContext db,
    FootballService football,
    UserService users,
    CurrentUser currentUser)
{
    public async Task<FantasyTeamView?> GetMyTeamAsync(CancellationToken ct = default)
    {
        var user = await GetCallerAsync(ct);
        var season = await GetCurrentSeasonAsync(ct);
        return await GetTeamAsync(user.Id, user.AuthUserId!.Value, season.Id, ct);
    }

    public async Task<FantasyTeamView?> GetTeamByAuthUserIdAsync(Guid authUserId, CancellationToken ct = default)
    {
        var season = await GetCurrentSeasonAsync(ct);
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.AuthUserId == authUserId && u.IsActive, ct);
        return user is null ? null : await GetTeamAsync(user.Id, authUserId, season.Id, ct);
    }

    public async Task<FantasyTeamView> SaveMyTeamAsync(SaveFantasyTeamRequest request, CancellationToken ct = default)
    {
        var user = await GetCallerAsync(ct);
        var season = await GetCurrentSeasonAsync(ct);
        var gameweek = await GetCurrentGameweekAsync(season.Id, ct);
        var availablePlayers = await football.GetPlayersAsync(season.Id, ct);
        var playersById = availablePlayers.ToDictionary(player => player.Id);

        var selections = request.Picks.Select(pick =>
        {
            if (!playersById.TryGetValue(pick.PlayerId, out var player))
                throw new FantasyRuleException($"Player {pick.PlayerId} is not available for this PSL season.");
            return new SquadPlayerSelection(pick.PlayerId, player.Position, player.TeamId, player.Price,
                pick.Slot, pick.IsCaptain, pick.IsViceCaptain, pick.IsBench);
        }).ToArray();
        FantasyRules.ValidateSquad(selections, request.Formation);

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var team = await db.FantasyTeams.AsTracking()
            .FirstOrDefaultAsync(t => t.UserId == user.Id && t.SeasonId == season.Id, ct);
        if (team is null)
        {
            team = new FantasyTeam { UserId = user.Id, SeasonId = season.Id, Name = request.TeamName.Trim() };
            db.FantasyTeams.Add(team);
            await db.SaveChangesAsync(ct);
        }

        team.Name = request.TeamName.Trim();
        team.Formation = request.Formation;
        team.BudgetRemaining = FantasyRules.StartingBudget - selections.Sum(selection => selection.Price);

        var existingPicks = await db.FantasySquads.AsTracking()
            .Where(pick => pick.FantasyTeamId == team.Id && pick.GameweekId == gameweek.Id)
            .ToListAsync(ct);
        foreach (var oldPick in existingPicks)
            oldPick.IsActive = false;

        var picksByPlayer = existingPicks.ToDictionary(pick => pick.PlayerId);
        foreach (var selection in selections)
        {
            if (!picksByPlayer.TryGetValue(selection.PlayerId, out var pick))
            {
                pick = new FantasySquadPick
                {
                    FantasyTeamId = team.Id,
                    PlayerId = selection.PlayerId,
                    GameweekId = gameweek.Id,
                };
                db.FantasySquads.Add(pick);
            }

            pick.IsActive = true;
            pick.Slot = checked((short)selection.Slot);
            pick.IsCaptain = selection.IsCaptain;
            pick.IsViceCaptain = selection.IsViceCaptain;
            pick.IsOnBench = selection.IsBench;
            pick.PurchasePrice = selection.Price;
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await GetTeamAsync(user.Id, user.AuthUserId!.Value, season.Id, ct)
            ?? throw new InvalidOperationException("Saved fantasy team could not be reloaded.");
    }

    public async Task<string> ActivateChipAsync(string chip, CancellationToken ct = default)
    {
        if (!FantasyRules.IsSupportedChip(chip))
            throw new FantasyRuleException("Choose Bench Boost, Triple Captain, or Wildcard.");
        var user = await GetCallerAsync(ct);
        var season = await GetCurrentSeasonAsync(ct);
        var gameweek = await GetCurrentGameweekAsync(season.Id, ct);
        var team = await db.FantasyTeams.AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == user.Id && t.SeasonId == season.Id, ct)
            ?? throw new FantasyConflictException("Create a fantasy team before using a chip.");

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.FantasyChips.Add(new FantasyChipUsage
        {
            FantasyTeamId = team.Id,
            GameweekId = gameweek.Id,
            Chip = chip,
            ActivatedAt = DateTimeOffset.UtcNow,
        });
        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(ct);
            throw new FantasyConflictException("A chip is already active for this gameweek.");
        }
        return chip;
    }

    public async Task<FantasyLeagueSummary> CreateLeagueAsync(string name, CancellationToken ct = default)
    {
        var cleanName = name?.Trim() ?? "";
        if (cleanName.Length is < 1 or > 50)
            throw new FantasyRuleException("League name must be between 1 and 50 characters.");
        var user = await GetCallerAsync(ct);
        var season = await GetCurrentSeasonAsync(ct);
        var team = await db.FantasyTeams.AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == user.Id && t.SeasonId == season.Id, ct)
            ?? throw new FantasyConflictException("Create a fantasy team before creating a league.");

        for (var attempt = 0; attempt < 5; attempt++)
        {
            var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(4));
            var league = new FantasyLeague
            {
                OwnerUserId = user.Id,
                SeasonId = season.Id,
                Name = cleanName,
                JoinCode = code,
                IsActive = true,
            };
            db.FantasyLeagues.Add(league);
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            try
            {
                await db.SaveChangesAsync(ct);
                db.FantasyLeagueMembers.Add(new FantasyLeagueMember
                {
                    FantasyLeagueId = league.Id,
                    UserId = user.Id,
                    FantasyTeamId = team.Id,
                    IsActive = true,
                    JoinedAt = DateTimeOffset.UtcNow,
                });
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
                return new FantasyLeagueSummary(league.Id, league.Name, league.JoinCode, season.Id, true, 1);
            }
            catch (DbUpdateException) when (attempt < 4)
            {
                await transaction.RollbackAsync(ct);
                db.Entry(league).State = EntityState.Detached;
            }
        }
        throw new FantasyConflictException("Could not create a unique league invite code. Try again.");
    }

    public async Task<FantasyLeagueMemberView> JoinLeagueAsync(string code, CancellationToken ct = default)
    {
        var cleanCode = code?.Trim().ToUpperInvariant() ?? "";
        if (cleanCode.Length != 8) throw new FantasyRuleException("Enter the 8-character league code.");
        var user = await GetCallerAsync(ct);

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Serialize joins for this league so two simultaneous requests cannot both
        // pass the 20-member check and exceed the capacity.
        var league = await db.FantasyLeagues.FromSqlInterpolated($"""
            SELECT * FROM app.fantasy_leagues
            WHERE join_code = {cleanCode} AND is_active = TRUE
            FOR UPDATE
            """).AsTracking().FirstOrDefaultAsync(ct)
            ?? throw new FantasyNotFoundException("League code not found.");

        if (await db.FantasyLeagueMembers.AnyAsync(m => m.FantasyLeagueId == league.Id && m.UserId == user.Id && m.IsActive, ct))
            throw new FantasyConflictException("You are already a member of this league.");

        var team = await db.FantasyTeams.AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == user.Id && t.SeasonId == league.SeasonId, ct)
            ?? throw new FantasyConflictException("Create a fantasy team before joining a league.");
        var memberCount = await db.FantasyLeagueMembers
            .CountAsync(m => m.FantasyLeagueId == league.Id && m.IsActive, ct);
        if (memberCount >= FantasyRules.MiniLeagueCapacity)
            throw new FantasyConflictException("This league is full (maximum 20 members).");

        var member = new FantasyLeagueMember
        {
            FantasyLeagueId = league.Id,
            UserId = user.Id,
            FantasyTeamId = team.Id,
            IsActive = true,
            JoinedAt = DateTimeOffset.UtcNow,
        };
        db.FantasyLeagueMembers.Add(member);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new FantasyLeagueMemberView(user.Id, user.Username, team.Id, team.Name, 0, 0);
    }

    public async Task<IReadOnlyList<FantasyLeagueSummary>> GetMyLeaguesAsync(CancellationToken ct = default)
    {
        var user = await GetCallerAsync(ct);
        var season = await GetCurrentSeasonAsync(ct);
        var memberships = await db.FantasyLeagueMembers.AsNoTracking()
            .Where(m => m.UserId == user.Id && m.IsActive)
            .Join(db.FantasyLeagues.AsNoTracking().Where(l => l.SeasonId == season.Id && l.IsActive),
                member => member.FantasyLeagueId, league => league.Id,
                (member, league) => new { Member = member, League = league })
            .ToListAsync(ct);
        var leagueIds = memberships.Select(row => row.League.Id).ToArray();
        var counts = await db.FantasyLeagueMembers.AsNoTracking().Where(m => leagueIds.Contains(m.FantasyLeagueId) && m.IsActive)
            .GroupBy(m => m.FantasyLeagueId).Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(row => row.Id, row => row.Count, ct);
        return memberships.Select(row => new FantasyLeagueSummary(row.League.Id, row.League.Name,
            row.League.OwnerUserId == user.Id ? row.League.JoinCode : "", season.Id,
            row.League.OwnerUserId == user.Id, counts.GetValueOrDefault(row.League.Id))).ToArray();
    }

    public async Task<FantasyLeagueView> GetLeagueAsync(int leagueId, int? gameweekId, CancellationToken ct = default)
    {
        var user = await GetCallerAsync(ct);
        var league = await db.FantasyLeagues.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == leagueId && l.IsActive, ct)
            ?? throw new FantasyNotFoundException("League not found.");
        await RequireMemberAsync(league.Id, user.Id, ct);

        var memberships = await db.FantasyLeagueMembers.AsNoTracking()
            .Where(m => m.FantasyLeagueId == league.Id && m.IsActive).ToListAsync(ct);
        var teamIds = memberships.Select(m => m.FantasyTeamId).Distinct().ToArray();
        var teams = await db.FantasyTeams.AsNoTracking().Where(t => teamIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, ct);
        var userIds = memberships.Select(m => m.UserId).Distinct().ToArray();
        var usernames = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Username, ct);
        var gameweekIds = await GetSeasonGameweekIdsAsync(league.SeasonId, gameweekId, ct);
        var points = await SumPointsAsync(teamIds, gameweekIds, ct);
        var overall = await SumPointsAsync(teamIds, await GetSeasonGameweekIdsAsync(league.SeasonId, null, ct), ct);

        var members = memberships.Select(member =>
        {
            teams.TryGetValue(member.FantasyTeamId, out var team);
            return new FantasyLeagueMemberView(member.UserId, usernames.GetValueOrDefault(member.UserId, "Touchline user"),
                member.FantasyTeamId, team?.Name ?? "Fantasy team", overall.GetValueOrDefault(member.FantasyTeamId),
                points.GetValueOrDefault(member.FantasyTeamId));
        }).OrderByDescending(member => gameweekId.HasValue ? member.GameweekPoints : member.TotalPoints)
          .ThenBy(member => member.TeamName).ToArray();

        return new FantasyLeagueView(league.Id, league.Name, league.SeasonId, members);
    }

    public async Task<IReadOnlyList<FantasyStanding>> GetStandingsAsync(int leagueId, int? gameweekId, CancellationToken ct = default)
    {
        var league = await GetLeagueAsync(leagueId, gameweekId, ct);
        return league.Members.Select((member, index) => new FantasyStanding(index + 1,
            member.UserId, member.Username, member.FantasyTeamId, member.TeamName,
            gameweekId.HasValue ? member.GameweekPoints : member.TotalPoints, member.TotalPoints)).ToArray();
    }

    private async Task<AppUser> GetCallerAsync(CancellationToken ct)
    {
        if (currentUser.AuthUserId is not Guid authUserId || string.IsNullOrWhiteSpace(currentUser.Email))
            throw new FantasyAuthenticationException("A valid signed-in Supabase user is required.");
        var user = await users.GetOrCreateAsync(authUserId, currentUser.Email, ct);
        if (!user.IsActive) throw new FantasyForbiddenException("This Touchline account is inactive.");
        return user;
    }

    private async Task<SeasonSummary> GetCurrentSeasonAsync(CancellationToken ct) =>
        await football.GetCurrentPslSeasonAsync(ct)
        ?? throw new FantasyNotFoundException("No current PSL season is configured.");

    private async Task<Gameweek> GetCurrentGameweekAsync(int seasonId, CancellationToken ct) =>
        await db.Gameweeks.AsNoTracking().Where(week => week.SeasonId == seasonId && week.IsActive)
            .OrderBy(week => week.StartDate).FirstOrDefaultAsync(ct)
        ?? throw new FantasyConflictException("There is no active gameweek for the current season.");

    private async Task<FantasyTeamView?> GetTeamAsync(int userId, Guid authUserId, int seasonId, CancellationToken ct)
    {
        var gameweek = await GetCurrentGameweekAsync(seasonId, ct);
        var team = await db.FantasyTeams.AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == userId && t.SeasonId == seasonId, ct);
        if (team is null) return null;

        var picks = await db.FantasySquads.AsNoTracking()
            .Where(p => p.FantasyTeamId == team.Id && p.GameweekId == gameweek.Id && p.IsActive)
            .OrderBy(p => p.Slot).ToListAsync(ct);
        var players = await football.GetPlayersAsync(seasonId, ct);
        var playerById = players.ToDictionary(player => player.Id);
        var viewPicks = picks.Select(pick => new FantasyPickView(pick.PlayerId, pick.Slot,
            pick.IsCaptain, pick.IsViceCaptain, pick.IsOnBench, pick.PurchasePrice ?? 0,
            playerById.GetValueOrDefault(pick.PlayerId))).ToArray();
        var weekPoints = await db.PointsResults.Where(result => result.FantasyTeamId == team.Id && result.GameweekId == gameweek.Id)
            .SumAsync(result => (int?)result.Points, ct) ?? 0;
        var gameweekIds = await GetSeasonGameweekIdsAsync(seasonId, null, ct);
        var totalPoints = await db.PointsResults.Where(result => result.FantasyTeamId == team.Id && gameweekIds.Contains(result.GameweekId))
            .SumAsync(result => (int?)result.Points, ct) ?? 0;
        return new FantasyTeamView(team.Id, authUserId, team.Name, team.Formation,
            team.BudgetRemaining, seasonId, gameweek.Id, gameweek.Name, weekPoints, totalPoints, viewPicks);
    }

    private async Task<int[]> GetSeasonGameweekIdsAsync(int seasonId, int? gameweekId, CancellationToken ct)
    {
        var query = db.Gameweeks.AsNoTracking().Where(week => week.SeasonId == seasonId);
        if (gameweekId.HasValue)
            query = query.Where(week => week.Id == gameweekId.Value);
        return await query.Select(week => week.Id).ToArrayAsync(ct);
    }

    private async Task<Dictionary<int, int>> SumPointsAsync(int[] teamIds, int[] gameweekIds, CancellationToken ct)
    {
        if (teamIds.Length == 0 || gameweekIds.Length == 0) return [];
        return await db.PointsResults.AsNoTracking()
            .Where(points => teamIds.Contains(points.FantasyTeamId) && gameweekIds.Contains(points.GameweekId))
            .GroupBy(points => points.FantasyTeamId)
            .Select(group => new { TeamId = group.Key, Points = group.Sum(row => row.Points) })
            .ToDictionaryAsync(row => row.TeamId, row => row.Points, ct);
    }

    private async Task RequireMemberAsync(int leagueId, int userId, CancellationToken ct)
    {
        if (!await db.FantasyLeagueMembers.AnyAsync(m => m.FantasyLeagueId == leagueId && m.UserId == userId && m.IsActive, ct))
            throw new FantasyForbiddenException("Join this league to view its teams and standings.");
    }
}

public sealed class FantasyConflictException(string message) : Exception(message);
public sealed class FantasyAuthenticationException(string message) : Exception(message);
public sealed class FantasyForbiddenException(string message) : Exception(message);
