import wrapPageElementWithTransition from './src/helpers/wrapPageElement.js';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

require('gatsby-remark-vscode/styles.css');

const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  },
});
appInsights.loadAppInsights();
appInsights.addTelemetryInitializer((item) => {
  item.tags['ai.cloud.role'] = 'SSW.Rules-StaticClientPage';
});
appInsights.trackPageView(); // Manually call trackPageView to establish the current user/session/pageview

// Page Transitions
export const wrapPageElement = wrapPageElementWithTransition;
