using Touchline.Api.Infrastructure;
using Touchline.Api.Middleware;
using Touchline.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var configuredOrigins = builder.Configuration.GetSection("Frontend:AllowedOrigins").Get<string[]>();
var allowedOrigins = configuredOrigins is { Length: > 0 }
    ? configuredOrigins
    : new[] { "http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5173", "http://127.0.0.1:5173" };

builder.Services.AddControllers();
builder.Services.AddHttpClient();
builder.Services.AddCors(options => options.AddPolicy("frontend", policy =>
    policy.WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()));

builder.Services.AddSingleton<SupabaseSettings>();
builder.Services.AddScoped<SupabaseRestClient>();
builder.Services.AddScoped<SupabaseTokenValidator>();
builder.Services.AddScoped<FantasyRules>();
builder.Services.AddScoped<FantasyService>();
builder.Services.AddSingleton<FantasyScoringService>();

var app = builder.Build();

app.UseCors("frontend");
app.UseMiddleware<ApiExceptionMiddleware>();
app.UseMiddleware<SupabaseAuthMiddleware>();
app.MapGet("/api/v1/health", () => Results.Ok(new { status = "ok", service = "Touchline API" }));
app.MapControllers();

app.Run();

public partial class Program;
