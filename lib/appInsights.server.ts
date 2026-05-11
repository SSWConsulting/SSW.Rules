/**
 * Server-side Application Insights telemetry helper
 * Uses the Node.js `applicationinsights` SDK (initialized in instrumentation.ts)
 * to track exceptions and custom events from API routes and server code.
 */

/**
 * Track an exception in Application Insights with optional contextual properties.
 * Falls back silently when the SDK is not initialised (e.g. local development).
 */
export function trackServerException(
  error: unknown,
  properties?: Record<string, string>
): void {
  try {
    // applicationinsights is only available after instrumentation.ts has run.
    // Use require() so this file is safe to import in any server context.
    const appInsights = require("applicationinsights");
    const client = appInsights.defaultClient;
    if (!client) return;

    const errorObj = error instanceof Error ? error : new Error(String(error));
    client.trackException({ exception: errorObj, properties });
  } catch {
    // Never let telemetry reporting crash the caller
  }
}

/**
 * Track a custom event in Application Insights.
 * Falls back silently when the SDK is not initialised.
 */
export function trackServerEvent(
  name: string,
  properties?: Record<string, string>
): void {
  try {
    const appInsights = require("applicationinsights");
    const client = appInsights.defaultClient;
    if (!client) return;

    client.trackEvent({ name, properties });
  } catch {
    // Never let telemetry reporting crash the caller
  }
}
