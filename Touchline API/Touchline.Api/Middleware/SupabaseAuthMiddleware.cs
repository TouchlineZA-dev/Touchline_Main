using System.Net;
using System.Text.Json;
using Touchline.Api.Infrastructure;

namespace Touchline.Api.Middleware;

public sealed class SupabaseAuthMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, SupabaseTokenValidator validator, SupabaseSettings settings)
    {
        if (!context.Request.Path.StartsWithSegments("/api/v1/fantasy"))
        {
            await next(context);
            return;
        }

        if (!settings.HasAuthSettings || !settings.HasDatabaseSettings)
        {
            await WriteError(context, HttpStatusCode.ServiceUnavailable, "Supabase API settings are not configured.");
            return;
        }

        var authorization = context.Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            await WriteError(context, HttpStatusCode.Unauthorized, "Sign in is required.");
            return;
        }

        var userId = await validator.GetUserIdAsync(authorization[7..].Trim(), context.RequestAborted);
        if (userId is null)
        {
            await WriteError(context, HttpStatusCode.Unauthorized, "The access token is invalid or expired.");
            return;
        }

        context.Items[SupabaseAuthMiddleware.UserIdItem] = userId.Value;
        await next(context);
    }

    public const string UserIdItem = "Touchline.AuthenticatedUserId";

    private static async Task WriteError(HttpContext context, HttpStatusCode status, string message)
    {
        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/json";
        await JsonSerializer.SerializeAsync(context.Response.Body, new { error = message }, cancellationToken: context.RequestAborted);
    }
}
