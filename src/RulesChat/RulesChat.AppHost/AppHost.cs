using Aspire.Hosting.JavaScript;

// Runs The Rulekeeper and the site locally: SQL Server in a container, the schema, the models, a sample index of the
// rules, and the Next.js site with the chat switched on. Start it from the repo root with:
//
//   pnpm aspire    (runs aspire run --project src/RulesChat/RulesChat.AppHost)
//
// See docs/rulekeeper/local-development.md.

var builder = DistributedApplication.CreateBuilder(args);

var repoRoot = Path.GetFullPath(Path.Combine(builder.AppHostDirectory, "../../.."));
const string embeddingModel = "bge-m3";
const string chatModel = "qwen3.5:9b";
const string ollamaUrl = "http://localhost:11434";
const int sqlPort = 14333;

// The password is generated on first run and kept in this project's user secrets. The data lives in the persistent
// container rather than a volume: SQL Server keeps the password it first started with, so a volume would refuse a new
// one, while a changed password makes Aspire recreate the container (with an empty database the next run refills).
var sql = builder.AddSqlServer("sql", port: sqlPort)
    .WithImageTag("2025-latest")
    .WithLifetime(ContainerLifetime.Persistent);
var database = sql.AddDatabase("RulesChat");

var schema = builder.AddProject<Projects.RulesChat_Database>("rules-chat-schema")
    .WithReference(database)
    .WaitFor(database);

// Docker on a Mac can't use the GPU, so there the Ollama app on the machine is used. Elsewhere Ollama runs in a
// container. Both listen on the same port, so the site and the index script don't need to know which.
string[] models = [embeddingModel, chatModel];
Func<IResourceBuilder<IResourceWithWaitSupport>, IResourceBuilder<IResourceWithWaitSupport>> waitForModels;
if (OperatingSystem.IsMacOS())
{
    var ollama = builder.AddExternalService("ollama", $"{ollamaUrl}/").WithHttpHealthCheck("/api/tags");
    var pulls = models
        .Select(model => builder.AddExecutable($"ollama-pull-{model.Replace(':', '-').Replace('.', '-')}", "ollama", repoRoot, "pull", model).WaitFor(ollama))
        .ToList();
    waitForModels = resource => pulls.Aggregate(resource, (current, pull) => current.WaitForCompletion(pull));
}
else
{
    var ollama = builder.AddOllama("ollama", port: 11434)
        .WithDataVolume("ssw-rules-chat-ollama")
        .WithLifetime(ContainerLifetime.Persistent);
    var pulled = models.Select(model => ollama.AddModel(model)).ToList();
    waitForModels = resource => pulled.Aggregate(resource, (current, model) => current.WaitFor(model));
}

// The site and the index script read the same settings, so they're set in one place.
IResourceBuilder<T> WithRulesChatSettings<T>(IResourceBuilder<T> resource) where T : IResourceWithEnvironment => resource
    .WithEnvironment("RULES_CHAT_SQL_SERVER", "localhost")
    .WithEnvironment("RULES_CHAT_SQL_PORT", sqlPort.ToString())
    .WithEnvironment("RULES_CHAT_SQL_DATABASE", database.Resource.DatabaseName)
    .WithEnvironment("RULES_CHAT_SQL_USER", "sa")
    .WithEnvironment("RULES_CHAT_SQL_PASSWORD", sql.Resource.PasswordParameter)
    .WithEnvironment("RULES_CHAT_SQL_TRUST_CERTIFICATE", "true")
    .WithEnvironment("RULES_CHAT_AI_BASE_URL", $"{ollamaUrl}/v1")
    .WithEnvironment("RULES_CHAT_AI_API_KEY", "ollama")
    .WithEnvironment("RULES_CHAT_EMBEDDING_MODEL", embeddingModel);

var site = WithRulesChatSettings(builder.AddJavaScriptApp("site", repoRoot, "dev"))
    .WithPnpm(installArgs: ["--frozen-lockfile"])
    .WithHttpEndpoint(port: 3000, env: "PORT")
    .WithUrlForEndpoint("http", url => url.Url = "/rules")
    .WithEnvironment("RULES_CHAT_ENABLED", "true")
    .WithEnvironment("RULES_CHAT_DEV_ACCESS", "true")
    .WithEnvironment("RULES_CHAT_CHAT_MODEL", chatModel)
    // Local reasoning models answer much faster without reasoning.
    .WithEnvironment("RULES_CHAT_REASONING_EFFORT", "none")
    .WithEnvironment("RULES_CHAT_MEMBER_DAILY_LIMIT", "0")
    .WithEnvironment("RULES_CHAT_MONTHLY_BUDGET_USD", "100")
    // Local models cost nothing.
    .WithEnvironment("RULES_CHAT_INPUT_PRICE_PER_MILLION_TOKENS_USD", "0")
    .WithEnvironment("RULES_CHAT_OUTPUT_PRICE_PER_MILLION_TOKENS_USD", "0")
    // The chat API reads the usage table, which a migration creates.
    .WaitForCompletion(schema);
waitForModels(site);

// "all" indexes every rule; a number indexes that many. Set RulesChat:IndexSample in appsettings.json or user secrets.
var indexSample = builder.Configuration["RulesChat:IndexSample"] ?? "200";
var index = WithRulesChatSettings(builder.AddNodeApp("rules-chat-index", repoRoot, "scripts/rules-chat/index-rules.mjs"))
    // The site's installer installs the packages; a second install here would race it.
    .WithPnpm(install: false)
    .WithArgs(indexSample == "all" ? [] : ["--sample", indexSample])
    .WaitForCompletion(schema);
// WithPnpm adds an installer only when running; the index needs its packages, but not the running site.
if (site.Resource.Annotations.OfType<JavaScriptPackageInstallerAnnotation>().SingleOrDefault() is { } installer)
{
    index.WaitForCompletion(builder.CreateResourceBuilder(installer.Resource));
}
waitForModels(index);

builder.Build().Run();
