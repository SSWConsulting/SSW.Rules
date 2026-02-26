export const isExternalSSWSite = (href: string): boolean => {
  if(href.includes("ssw.com.au") && !href.includes("ssw.com.au/rules"))
  {
    return true;
  }
  const externalSSWSitePatterns =
    /^(https:\/\/(?:www\.)?ssw\.com\.au\/(?:people|rules|ssw)(?:\/|$))/i;
  return externalSSWSitePatterns.test(href);
};

export const isExternalLink = (href: string): boolean => {
  // i.e. href = https://anydomain.com.au => true | href = https://www.ssw.com.au/rule/* => true for SSW External Site | href = /company => false for relative path
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