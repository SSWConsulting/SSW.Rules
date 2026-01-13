/**
 * Next.js Instrumentation Hook
 * This file runs once during server startup (before any requests are handled)
 * Used to initialize server-side Application Insights telemetry
 */

export async function register() {
  // Only initialize on Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Skip Application Insights in local development
    if (process.env.NODE_ENV === "development") {
      console.log("🔧 Local development mode - Application Insights disabled");
      return;
    }

    const connectionString =
      process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;

    if (connectionString) {
      const appInsights = await import("applicationinsights");

      // Configure Application Insights
      appInsights
        .setup(connectionString)
        .setAutoCollectRequests(true) // Track HTTP requests (API routes, SSR)
        .setAutoCollectPerformance(true, true) // Track performance metrics
        .setAutoCollectExceptions(true) // Track unhandled exceptions
        .setAutoCollectDependencies(true) // Track external dependencies (DB, APIs)
        .setAutoCollectConsole(true, true) // Track console logs (errors/warnings)
        .setUseDiskRetryCaching(true) // Retry failed sends
        .setSendLiveMetrics(false) // Disable live metrics for performance
        .setDistributedTracingMode(
          appInsights.DistributedTracingModes.AI_AND_W3C
        ); // Enable distributed tracing

      // Start collecting telemetry
      appInsights.start();

      // Set cloud role name for better filtering in Azure Portal
      const client = appInsights.defaultClient;
      client.context.tags[client.context.keys.cloudRole] =
        "SSW.Rules-NextJS-Server";

      console.log("✅ Application Insights server-side tracking initialized");
    } else {
      console.warn(
        "⚠️ NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING not set - server telemetry disabled"
      );
    }
  }
}
