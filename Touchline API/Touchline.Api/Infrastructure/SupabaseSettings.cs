namespace Touchline.Api.Infrastructure;

public sealed class SupabaseSettings(IConfiguration configuration)
{
    public string Url { get; } = Normalize(configuration["Supabase:Url"] ?? "");
    public string AnonKey { get; } = configuration["Supabase:AnonKey"] ?? "";
    public string ServiceRoleKey { get; } = configuration["Supabase:ServiceRoleKey"] ?? "";

    public bool HasAuthSettings => Uri.TryCreate(Url, UriKind.Absolute, out _) && !string.IsNullOrWhiteSpace(AnonKey);
    public bool HasDatabaseSettings => Uri.TryCreate(Url, UriKind.Absolute, out _) && !string.IsNullOrWhiteSpace(ServiceRoleKey);

    private static string Normalize(string value)
    {
        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)) return value.Trim().TrimEnd('/');
        return uri.GetLeftPart(UriPartial.Authority);
    }
}
