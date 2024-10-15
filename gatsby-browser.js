import wrapPageElementWithTransition from './src/helpers/wrapPageElement.js';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

require('gatsby-remark-vscode/styles.css');

const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    extensionConfig: {
      ['AppInsightsCfgSyncPlugin']: {
        cfgUrl: '',
      },
    },
  },
});
appInsights.loadAppInsights();
appInsights.addTelemetryInitializer((item) => {
  item.tags['ai.cloud.role'] = 'SSW.Rules-StaticClientPage';
});
appInsights.trackPageView();

// Page Transitions
export const wrapPageElement = wrapPageElementWithTransition;
