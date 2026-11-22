using System.Net;
using System.Text.Json;
using Touchline.Api.Infrastructure;

namespace Touchline.Api.Middleware;

public sealed class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception exception) when (!context.Response.HasStarted)
        {
            logger.LogError(exception, "Unhandled Touchline API request failure for {Path}", context.Request.Path);
            var status = exception is SupabaseRequestException ? HttpStatusCode.BadGateway
                : exception is InvalidOperationException ? HttpStatusCode.ServiceUnavailable
                : HttpStatusCode.InternalServerError;
            context.Response.Clear();
            context.Response.StatusCode = (int)status;
            context.Response.ContentType = "application/json";
            await JsonSerializer.SerializeAsync(context.Response.Body,
                new { error = "The request could not be completed." }, cancellationToken: context.RequestAborted);
        }
    }
}
