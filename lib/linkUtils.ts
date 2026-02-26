
/**
 * Determines whether a given href points to a trusted external SSW-branded site.
 *
 * SSW sites are treated as trusted, so they do not receive `noopener noreferrer nofollow`
 * rel attributes when rendered as external links.
 *
 * @param href - The URL to evaluate.
 * @returns `true` if the href points to an SSW-branded site (excluding `ssw.com.au/rules`), `false` otherwise.
 * @example
 * isExternalSSWSite("https://ssw.com.au/people")        // true
 * isExternalSSWSite("https://www.ssw.com.au/ssw/")      // true
 * isExternalSSWSite("https://ssw.com.au/rules")         // false
 * isExternalSSWSite("https://google.com")               // false
 */
export const isExternalSSWSite = (href: string): boolean => {
  if(href.startsWith("/") && !href.startsWith("/rules"))
  {
    return true;
  }
  if(href.includes("ssw.com.au") && !href.includes("ssw.com.au/rules"))
  {
    return true;
  }
  const externalSSWSitePatterns =
    /^(https:\/\/(?:www\.)?ssw\.com\.au\/(?:people|ssw)(?:\/|$))/i;
  return externalSSWSitePatterns.test(href);
};

/**
 * Determines whether a given href should be treated as an external link.
 *
 * @param href - The URL or path to evaluate.
 * @returns `true` if the link points outside the current site (including SSW external sites), `false` if it's on ssw.com.au/rules
 * @example
 * isExternalLink("https://www.ssw.com.au/rules/*")   // false
 * isExternalLink("https://www.ssw.com.au/people")    // true
 * isExternalLink("https://anydomain.com.au")         // true
 * isExternalLink("/company")                         // true
 */
export const isExternalLink = (href: string): boolean => {
  if(href.startsWith("/"))
  {
    if(href.startsWith("/rules"))
    {
      return false;
    }
    return true;
  }
  
  if(isExternalSSWSite(href))
  {
    return true;
  }
  return (
    (href?.startsWith("https://") && !href.includes("ssw.com.au")) // checking relative path and external domains i.e. /company
  );
};