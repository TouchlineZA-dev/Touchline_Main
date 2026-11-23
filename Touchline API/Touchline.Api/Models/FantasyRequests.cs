using System.ComponentModel.DataAnnotations;

namespace Touchline.Api.Models;

public sealed class SaveFantasyTeamRequest
{
    [Required, StringLength(40, MinimumLength = 1)]
    public string TeamName { get; init; } = "";

    [Required]
    public string Formation { get; init; } = "";

    [Required, MinLength(15), MaxLength(15)]
    public List<FantasyPickRequest> Picks { get; init; } = [];
}

public sealed class FantasyPickRequest
{
    [Range(1, long.MaxValue)]
    public long PlayerId { get; init; }

    [Range(0, 14)]
    public int Slot { get; init; }

    public bool IsCaptain { get; init; }
    public bool IsViceCaptain { get; init; }
    public bool IsBench { get; init; }
}

public sealed class ActivateChipRequest
{
    [Required]
    public string Chip { get; init; } = "";
}

public sealed class CreateLeagueRequest
{
    [Required, StringLength(50, MinimumLength = 1)]
    public string Name { get; init; } = "";
}

public sealed class JoinLeagueRequest
{
    [Required, StringLength(8, MinimumLength = 8)]
    public string Code { get; init; } = "";
}
