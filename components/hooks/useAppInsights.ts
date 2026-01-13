import { ApplicationInsights } from "@microsoft/applicationinsights-web";

// Singleton instance to avoid recreating on every component render
let appInsightsInstance: ApplicationInsights | null = null;

/**
 * Initialize Application Insights client-side SDK
 * Returns a singleton instance with tracking methods
 */
function getAppInsights(): ApplicationInsights | null {
  if (typeof window === "undefined") {
    return null; // SSR guard
  }

  // Return existing instance if already initialized
  if (appInsightsInstance) {
    return appInsightsInstance;
  }

  // Skip Application Insights in local development
  if (process.env.NODE_ENV === "development") {
    console.log("🔧 Local development mode - Application Insights disabled");
    return null;
  }

  const connectionString =
    process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    console.warn(
      "⚠️ NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING not set - client telemetry disabled"
    );
    return null;
  }

  try {
    const ai = new ApplicationInsights({
      config: {
        connectionString,
        enableAutoRouteTracking: true, // Auto-track route changes
        disableFetchTracking: false, // Track fetch/XHR requests
        enableCorsCorrelation: true, // Enable cross-origin correlation
        enableRequestHeaderTracking: true,
        enableResponseHeaderTracking: true,
        extensionConfig: {
          // Fix for https://github.com/microsoft/ApplicationInsights-JS/issues/2341
          ["AppInsightsCfgSyncPlugin"]: {
            cfgUrl: "",
          },
        },
      },
    });

    ai.loadAppInsights();

    // Add telemetry initializer for custom tags
    ai.addTelemetryInitializer((item) => {
      // Set cloud role for filtering in Azure Portal
      item.tags = item.tags || [];
      item.tags["ai.cloud.role"] = "SSW.Rules-StaticClientPage";

      // Fix Google Analytics CORS errors being marked as failures
      // See: https://github.com/SSWConsulting/SSW.Rules/issues/1589#issuecomment-2437107468
      if (
        (item.baseData?.target?.includes("analytics.google.com") ||
          item.baseData?.target?.includes("www.google-analytics.com")) &&
        item.baseData?.responseCode === 0
      ) {
        item.baseData.success = true;
      }

      return true;
    });

    appInsightsInstance = ai;
    console.log("✅ Application Insights client-side tracking initialized");

    return ai;
  } catch (error) {
    console.error("❌ Failed to initialize Application Insights:", error);
    return null;
  }
}

export interface AppInsightsTracking {
  trackPage: () => void;
  trackException: (error: Error | string, severityLevel?: number) => void;
  trackEvent: (name: string, properties?: Record<string, any>) => void;
  trackTrace: (message: string, severityLevel?: number) => void;
}

/**
 * React hook for Application Insights telemetry tracking
 * Provides methods for manual tracking of events, errors, and traces
 */
export default function useAppInsights(): AppInsightsTracking {
  const ai = getAppInsights();

  const trackPage = () => {
    if (!ai) return;
    ai.trackPageView({ name: window.location.href });
  };

  const trackException = (error: Error | string, severityLevel?: number) => {
    if (!ai) return;
    const errorObj = typeof error === "string" ? new Error(error) : error;
    ai.trackException({
      error: errorObj,
      severityLevel,
    });
  };

  const trackEvent = (name: string, properties?: Record<string, any>) => {
    if (!ai) return;
    ai.trackEvent({ name, properties });
  };

  const trackTrace = (message: string, severityLevel?: number) => {
    if (!ai) return;
    ai.trackTrace({
      message,
      severityLevel,
    });
  };

  return {
    trackPage,
    trackException,
    trackEvent,
    trackTrace,
  };
}

/**
 * Get the raw Application Insights instance for advanced usage
 */
export function getAppInsightsInstance(): ApplicationInsights | null {
  return getAppInsights();
}
