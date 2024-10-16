import wrapPageElementWithTransition from './src/helpers/wrapPageElement.js';

require('gatsby-remark-vscode/styles.css');

export const onRouteUpdate = () => {
  if (window.appInsights && window.appInsights.trackPage) {
    window.appInsights.trackPage();
  }
};

// Page Transitions
export const wrapPageElement = wrapPageElementWithTransition;
