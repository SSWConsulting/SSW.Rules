/**
 * Server-side Application Insights helpers.
 *
 * The `applicationinsights` SDK is initialised once by `instrumentation.ts`.
 * This module exposes thin wrappers around `defaultClient` so that
 * server components, API routes, and service functions can explicitly
 * track exceptions and traces with structured properties – making them
 * easy to query in Azure Application Insights.
 */

// The severity field on trackException/trackTrace accepts a numeric enum.
// We define our own matching values to avoid importing the full SDK at type level.

// Re-export severity levels so callers don't need to import the SDK.
export const SeverityLevel = {
  Verbose: 0,
  Information: 1,
  Warning: 2,
  Error: 3,
  Critical: 4,
} as const;

type SeverityLevelValue = (typeof SeverityLevel)[keyof typeof SeverityLevel];

function getClient() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ai = require("applicationinsights");
    return ai.defaultClient as import("applicationinsights").TelemetryClient | undefined;
  } catch {
    // SDK not available (e.g. local dev or edge runtime)
    return undefined;
  }
}

/**
 * Track an exception with optional custom properties.
 * Falls back to `console.error` when App Insights is unavailable.
 */
export function trackServerException(
  error: unknown,
  properties?: Record<string, string>,
  severityLevel: SeverityLevelValue = SeverityLevel.Error,
) {
  const err = error instanceof Error ? error : new Error(String(error));
  const client = getClient();

  if (client) {
    client.trackException({
      exception: err,
      severity: severityLevel as any,
      properties: {
        source: "SSW.Rules-Server",
        ...properties,
      },
    });
  }

  // Always log to console as well for local debugging / log stream
  console.error(`[AppInsights:${severityLevel}]`, err.message, properties ?? "");
}

/**
 * Track a trace / log message with optional custom properties.
 */
export function trackServerTrace(
  message: string,
  severityLevel: SeverityLevelValue = SeverityLevel.Information,
  properties?: Record<string, string>,
) {
  const client = getClient();

  if (client) {
    client.trackTrace({
      message,
      severity: severityLevel as any,
      properties: {
        source: "SSW.Rules-Server",
        ...properties,
      },
    });
  }

  if (severityLevel >= SeverityLevel.Warning) {
    console.warn(`[AppInsights:${severityLevel}]`, message, properties ?? "");
  }
}
