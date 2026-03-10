const titles = {
  '/latest-rules/': `Latest Rules`,
  '/user/': `User Rules`,
  '/orphaned/': `Orphaned Rules`,
  '/archived/': `Archived Rules`,
  '/profile/': `Profile`,
};

export const siteTitle = `SSW.Rules`;
export const siteTitleShort = `SSW.Rules`;
export const siteDescription = `Secret Ingredients to Quality Software | SSW Rules provides best practices for developing secure, reliable, and efficient .NET, Azure, CRM, Angular, React, Dynamics, and AI applications. Learn more today!`;
export const homePageDescription = `Explore SSW Rules – a trusted library of best practices for software development and project management designed to foster growth and boost productivity!`;
export const siteUrl = `https://www.ssw.com.au/rules`;
export const siteUrlRelative = `/`;
export const themeColor = `#cc4141`;
export const backgroundColor = `#fff`;

// SSW brand color palette — single source of truth for TypeScript consumers
export const colors = {
  sswRed: "#cc4141",
  sswLightRed: "#d26e6e",
  sswRedTint: "#fdecea", // very light red, used for shape fills
  sswGray: "#797979",
  sswBlack: "#333333",
  sswLightBg: "#f6f8fa", // matches --color-table-odd
  white: "#ffffff",
} as const;
export const pathPrefix = `/rules`;
export const social = {
  twitter: `SSW_TV`,
  fbAppId: `120920301257947`,
};
export const parentSiteUrl = `https://www.ssw.com.au`;
export const breadcrumbDefault = `SSW Rules`;
export const homepageTitle = `Secret Ingredients to Quality Software (Open Source on GitHub)`;
export const trailingSlash = `never`;
export { titles };

const config = {
  siteTitle,
  siteTitleShort,
  siteDescription,
  homePageDescription,
  siteUrl,
  siteUrlRelative,
  themeColor,
  backgroundColor,
  pathPrefix,
  social,
  parentSiteUrl,
  breadcrumbDefault,
  homepageTitle,
  trailingSlash,
  titles,
};

export default config;