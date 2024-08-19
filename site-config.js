/*eslint quotes: ["warn", "backtick"]*/
/** @type {import('gatsby').GatsbyConfig} */

const titles = {
  '/latest-rules/': `Latest Rules`,
  '/user/': `User Rules`,
  '/orphaned/': `Orphaned Rules`,
  '/archived/': `Archived Rules`,
  '/profile/': `Profile`,
};

module.exports = {
  siteTitle: `SSW.Rules`,
  siteTitleShort: `SSW.Rules`,
  siteDescription: `Secret Ingredients to Quality Software | SSW Rules provides best practices for developing secure, reliable, and efficient .NET, Azure, CRM, Angular, React, Dynamics, and AI applications. Learn more today!`,
  siteUrl: `https://www.ssw.com.au/rules`,
  // Relative URL to website home
  siteUrlRelative: `/`,
  themeColor: `#cc4141`,
  backgroundColor: `#fff`,
  pathPrefix: `/rules`,
  social: {
    twitter: `SSW_TV`,
    fbAppId: `120920301257947`,
  },
  parentSiteUrl: `https://www.ssw.com.au`,
  breadcrumbDefault: `SSW Rules`,
  homepageTitle: `Secret Ingredients to Quality Software (Open Source on GitHub)`,
  trailingSlash: `never`,
  titles: titles,
};
