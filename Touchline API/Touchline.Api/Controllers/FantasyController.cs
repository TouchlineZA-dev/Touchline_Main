using Microsoft.AspNetCore.Mvc;
using Touchline.Api.Infrastructure;
using Touchline.Api.Middleware;
using Touchline.Api.Models;
using Touchline.Api.Services;

namespace Touchline.Api.Controllers;

[ApiController]
[Route("api/v1/fantasy")]
public sealed class FantasyController(FantasyService fantasy) : ControllerBase
{
    [HttpGet("team")]
    public async Task<IActionResult> GetTeam(CancellationToken cancellationToken)
    {
        var team = await fantasy.GetMyTeamAsync(CurrentUserId, cancellationToken);
        return Ok(new { team });
    }

    [HttpPut("team")]
    public async Task<IActionResult> SaveTeam(SaveFantasyTeamRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var team = await fantasy.SaveTeamAsync(CurrentUserId, request, cancellationToken);
            return Ok(new { team });
        }
        catch (FantasyRuleException exception) { return BadRequest(new { error = exception.Message }); }
        catch (SupabaseRequestException exception) { return SupabaseError(exception); }
    }

    [HttpPost("chip")]
    public async Task<IActionResult> ActivateChip(ActivateChipRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var team = await fantasy.ActivateChipAsync(CurrentUserId, request.Chip, cancellationToken);
            return Ok(new { team });
        }
        catch (FantasyRuleException exception) { return BadRequest(new { error = exception.Message }); }
        catch (SupabaseRequestException exception) { return SupabaseError(exception); }
    }

    [HttpGet("teams/{userId:guid}")]
    public async Task<IActionResult> GetOtherTeam(Guid userId, CancellationToken cancellationToken)
    {
        var team = await fantasy.GetOtherTeamAsync(userId, cancellationToken);
        return team is null ? NotFound(new { error = "Fantasy team not found." }) : Ok(new { team });
    }

    [HttpGet("leagues")]
    public async Task<IActionResult> GetLeagues(CancellationToken cancellationToken) =>
        Ok(new { leagues = await fantasy.GetMyLeaguesAsync(CurrentUserId, cancellationToken) });

    [HttpPost("leagues")]
    public async Task<IActionResult> CreateLeague(CreateLeagueRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var league = await fantasy.CreateLeagueAsync(CurrentUserId, request.Name, cancellationToken);
            return Created("/api/v1/fantasy/leagues", new { league });
        }
        catch (FantasyRuleException exception) { return BadRequest(new { error = exception.Message }); }
        catch (SupabaseRequestException exception) { return SupabaseError(exception); }
    }

    [HttpPost("leagues/join")]
    public async Task<IActionResult> JoinLeague(JoinLeagueRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var membership = await fantasy.JoinLeagueAsync(CurrentUserId, request.Code, cancellationToken);
            return Ok(new { membership });
        }
        catch (FantasyRuleException exception) { return BadRequest(new { error = exception.Message }); }
        catch (SupabaseRequestException exception) { return SupabaseError(exception); }
    }

    [HttpGet("leagues/{leagueId:guid}")]
    public async Task<IActionResult> GetLeague(Guid leagueId, CancellationToken cancellationToken)
    {
        try
        {
            var league = await fantasy.GetLeagueAsync(CurrentUserId, leagueId, cancellationToken);
            return league is null ? NotFound(new { error = "League not found." }) : Ok(new { league });
        }
        catch (FantasyAccessException exception) { return StatusCode(403, new { error = exception.Message }); }
    }

    [HttpGet("leagues/{leagueId:guid}/standings")]
    public async Task<IActionResult> GetStandings(Guid leagueId, [FromQuery] int? gameweek, CancellationToken cancellationToken)
    {
        try
        {
            var standings = await fantasy.GetLeagueStandingsAsync(CurrentUserId, leagueId, gameweek, cancellationToken);
            return Ok(new { gameweek, standings });
        }
        catch (FantasyRuleException exception) { return BadRequest(new { error = exception.Message }); }
        catch (FantasyAccessException exception) { return StatusCode(403, new { error = exception.Message }); }
    }

    private Guid CurrentUserId => HttpContext.Items[SupabaseAuthMiddleware.UserIdItem] is Guid userId
        ? userId
        : throw new InvalidOperationException("Authenticated user ID was not set by middleware.");

    private IActionResult SupabaseError(SupabaseRequestException exception)
    {
        var status = exception.StatusCode is >= 400 and < 500 ? exception.StatusCode : 502;
        return StatusCode(status, new { error = exception.Message });
    }
}
