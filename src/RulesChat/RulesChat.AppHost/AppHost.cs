using Aspire.Hosting.JavaScript;

// Runs The Rulekeeper and the site locally: SQL Server in a container, the schema, the embedding model, a sample index
// of the rules, and the Next.js site. Start it from the repo root with:
//
//   aspire run --project src/RulesChat/RulesChat.AppHost
//
// See docs/rulekeeper/local-development.md.

var builder = DistributedApplication.CreateBuilder(args);

var repoRoot = Path.GetFullPath(Path.Combine(builder.AppHostDirectory, "../../.."));
const string embeddingModel = "bge-m3";
const string ollamaUrl = "http://localhost:11434";
const int sqlPort = 14333;

// The password is generated on first run and kept in this project's user secrets, so it survives restarts.
var sql = builder.AddSqlServer("sql", port: sqlPort)
    .WithImageTag("2025-latest")
    .WithDataVolume("ssw-rules-chat-sql")
    .WithLifetime(ContainerLifetime.Persistent);
var database = sql.AddDatabase("RulesChat");

var schema = builder.AddProject<Projects.RulesChat_Database>("rules-chat-schema")
    .WithReference(database)
    .WaitFor(database);

// Docker on a Mac can't use the GPU, so there the Ollama app on the machine is used. Elsewhere Ollama runs in a
// container. Both listen on the same port, so the index script doesn't need to know which.
Func<IResourceBuilder<NodeAppResource>, IResourceBuilder<NodeAppResource>> waitForEmbeddingModel;
if (OperatingSystem.IsMacOS())
{
    var ollama = builder.AddExternalService("ollama", $"{ollamaUrl}/").WithHttpHealthCheck("/api/tags");
    var pull = builder.AddExecutable($"ollama-pull-{embeddingModel}", "ollama", repoRoot, "pull", embeddingModel)
        .WaitFor(ollama);
    waitForEmbeddingModel = resource => resource.WaitForCompletion(pull);
}
else
{
    var model = builder.AddOllama("ollama", port: 11434)
        .WithDataVolume("ssw-rules-chat-ollama")
        .WithLifetime(ContainerLifetime.Persistent)
        .AddModel(embeddingModel);
    waitForEmbeddingModel = resource => resource.WaitFor(model);
}

var site = builder.AddJavaScriptApp("site", repoRoot, "dev")
    .WithPnpm(installArgs: ["--frozen-lockfile"])
    .WithHttpEndpoint(port: 3000, env: "PORT")
    .WithUrlForEndpoint("http", url => url.Url = "/rules");
// WithPnpm adds this resource to install the packages; the index needs them, but not the running site.
var siteInstaller = builder.CreateResourceBuilder(site.Resource.Annotations.OfType<JavaScriptPackageInstallerAnnotation>().Single().Resource);

// "all" indexes every rule; a number indexes that many. Set RulesChat:IndexSample in appsettings.json or user secrets.
var indexSample = builder.Configuration["RulesChat:IndexSample"] ?? "200";
var index = builder.AddNodeApp("rules-chat-index", repoRoot, "scripts/rules-chat/index-rules.mjs")
    // The site's installer installs the packages; a second install here would race it.
    .WithPnpm(install: false)
    .WithArgs(indexSample == "all" ? [] : ["--sample", indexSample])
    .WithEnvironment("RULES_CHAT_SQL_SERVER", "localhost")
    .WithEnvironment("RULES_CHAT_SQL_PORT", sqlPort.ToString())
    .WithEnvironment("RULES_CHAT_SQL_DATABASE", database.Resource.DatabaseName)
    .WithEnvironment("RULES_CHAT_SQL_USER", "sa")
    .WithEnvironment("RULES_CHAT_SQL_PASSWORD", sql.Resource.PasswordParameter)
    .WithEnvironment("RULES_CHAT_SQL_TRUST_CERTIFICATE", "true")
    .WithEnvironment("RULES_CHAT_AI_BASE_URL", $"{ollamaUrl}/v1")
    .WithEnvironment("RULES_CHAT_AI_API_KEY", "ollama")
    .WithEnvironment("RULES_CHAT_EMBEDDING_MODEL", embeddingModel)
    .WaitForCompletion(schema)
    .WaitForCompletion(siteInstaller);
waitForEmbeddingModel(index);

builder.Build().Run();
