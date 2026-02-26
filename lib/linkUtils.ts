export const isExternalSSWSite = (href: string): boolean => {
  if(href.includes("ssw.com.au") && !href.includes("ssw.com.au/rules"))
  {
    return true;
  }
  const externalSSWSitePatterns =
    /^(https:\/\/(?:www\.)?ssw\.com\.au\/(?:people|rules|ssw)(?:\/|$))/i;
  return externalSSWSitePatterns.test(href);
};

/**
 * Determines whether a given href should be treated as an external link.
 *
 * @param href - The URL or path to evaluate.
 * @returns `true` if the link points outside the current site (including SSW external sites), `false` if it's on ssw.com.au/rules
 * @example
 * isExternalLink("https://www.ssw.com.au/rules/*")   // false
 * isExternalLink("https://anydomain.com.au")         // true
 * isExternalLink("/company")                         // true
 */
export const isExternalLink = (href: string): boolean => {
  if(href.includes("ssw.com.au/rules"))
  {
    return false;
  }
  if(isExternalSSWSite(href))
  {
    return true;
  }
  return (
    (href?.startsWith("https://") && !href.includes("ssw.com.au")) // checking relative path and external domains i.e. /company
  );
};