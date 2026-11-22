using System.Net.Http.Headers;
using System.Text.Json;

namespace Touchline.Api.Infrastructure;

public sealed class SupabaseTokenValidator(IHttpClientFactory clients, SupabaseSettings settings)
{
    public async Task<Guid?> GetUserIdAsync(string accessToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(accessToken)) return null;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{settings.Url}/auth/v1/user");
            request.Headers.Add("apikey", settings.AnonKey);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            using var response = await clients.CreateClient().SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var user = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            return Guid.TryParse(user.RootElement.GetProperty("id").GetString(), out var id) ? id : null;
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException or KeyNotFoundException)
        {
            return null;
        }
    }
}
