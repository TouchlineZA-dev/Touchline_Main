using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
namespace Touchline.Api.Infrastructure;

public sealed class SupabaseRestClient(IHttpClientFactory clients, SupabaseSettings settings)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<JsonArray> GetRowsAsync(string schema, string table, CancellationToken cancellationToken,
        params (string Key, string Value)[] query)
    {
        var queryString = string.Join("&", query.Select(pair =>
            $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
        var rows = new JsonArray();
        const int pageSize = 1000;
        for (var offset = 0; ; offset += pageSize)
        {
            var page = await SendAsync(HttpMethod.Get, schema, table, queryString, null,
                cancellationToken, new RangeHeaderValue(offset, offset + pageSize - 1)) as JsonArray ?? [];
            foreach (var row in page) rows.Add(row?.DeepClone());
            if (page.Count < pageSize) return rows;
        }
    }

    public Task<JsonNode?> RpcAsync(string schema, string functionName, object payload, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, schema, $"rpc/{functionName}", "", JsonSerializer.SerializeToNode(payload, JsonOptions), cancellationToken);

    private async Task<JsonNode?> SendAsync(HttpMethod method, string schema, string resource, string query,
        JsonNode? body, CancellationToken cancellationToken, RangeHeaderValue? range = null)
    {
        if (!settings.HasDatabaseSettings)
            throw new InvalidOperationException("Supabase database settings are missing.");

        var url = $"{settings.Url}/rest/v1/{resource}" + (string.IsNullOrEmpty(query) ? "" : $"?{query}");
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Add("apikey", settings.ServiceRoleKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ServiceRoleKey);
        request.Headers.Add("Accept-Profile", schema);
        if (range is not null) request.Headers.Range = range;
        if (method != HttpMethod.Get) request.Headers.Add("Content-Profile", schema);
        if (body is not null)
            request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");

        using var response = await clients.CreateClient().SendAsync(request, cancellationToken);
        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var detail = content;
            try { detail = JsonNode.Parse(content)?["message"]?.GetValue<string>() ?? content; }
            catch (JsonException) { }
            throw new SupabaseRequestException((int)response.StatusCode, detail);
        }
        if (string.IsNullOrWhiteSpace(content)) return null;
        return JsonNode.Parse(content);
    }
}

public sealed class SupabaseRequestException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
