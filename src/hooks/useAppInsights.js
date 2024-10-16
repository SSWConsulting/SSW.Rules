import { ApplicationInsights } from '@microsoft/applicationinsights-web';

export default function useAppInsights() {
  const ai =
    typeof window !== 'undefined' &&
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING &&
    new ApplicationInsights({
      config: {
        connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
      },
    });

  if (ai) {
    ai.loadAppInsights();
    ai.addTelemetryInitializer((item) => {
      item.tags['ai.cloud.role'] = 'SSW.Rules-StaticClientPage';
    });
  }

  const trackPage = ai
    ? () => ai.trackPageView({ name: window.location.href })
    : () => {};

  const trackException = ai
    ? function (error, severityLevel) {
        ai.trackException({
          error: new Error(error),
          severityLevel: severityLevel,
        });
      }
    : () => {};

  const trackEvent = ai
    ? function (name) {
        ai.trackEvent({ name });
      }
    : () => {};

  const trackTrace = ai
    ? function (message, level) {
        ai.trackTrace({
          message,
          severityLevel: level,
        });
      }
    : () => {};

  const appInsights = {
    trackPage,
    trackException,
    trackEvent,
    trackTrace,
  };

  // store instance
  if (typeof window !== 'undefined') {
    window['appInsights'] = appInsights;
  }

  return appInsights;
}
