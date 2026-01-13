"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { getAppInsightsInstance } from "../hooks/useAppInsights";

/**
 * Internal component that handles route change tracking
 * Must be wrapped in Suspense due to useSearchParams usage
 */
function RouteChangeTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ai = getAppInsightsInstance();
    if (ai) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");
      ai.trackPageView({ uri: url });
    }
  }, [pathname, searchParams]);

  return null;
}

/**
 * Application Insights Provider Component
 * Initializes client-side telemetry and tracks route changes automatically
 */
export default function AppInsightsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Initialize App Insights on mount
    getAppInsightsInstance();

    // Track initial page view
    const ai = getAppInsightsInstance();
    if (ai) {
      ai.trackPageView();
    }

    // Set up global error handler for unhandled exceptions
    const handleError = (event: ErrorEvent) => {
      const ai = getAppInsightsInstance();
      if (ai) {
        ai.trackException({
          error: event.error || new Error(event.message),
          severityLevel: 3, // Error
        });
      }
    };

    // Set up unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const ai = getAppInsightsInstance();
      if (ai) {
        ai.trackException({
          error:
            event.reason instanceof Error
              ? event.reason
              : new Error(String(event.reason)),
          severityLevel: 3, // Error
        });
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <RouteChangeTracker />
      </Suspense>
    </>
  );
}
