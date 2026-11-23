using Microsoft.AspNetCore.Mvc;
using Touchline.Api.Services;

namespace Touchline.Api.Controllers;

[ApiController]
[Route("api/v1/players")]
public sealed class PlayersController(FantasyService fantasy) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPlayers(CancellationToken cancellationToken)
    {
        var payload = await fantasy.GetFantasyPlayersAsync(cancellationToken);
        return Ok(payload);
    }
}
