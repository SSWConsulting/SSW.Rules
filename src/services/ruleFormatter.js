module.exports = function (md) {
  md = md.replace(`<!--endintro-->`, '');

  // unindent lists to fix parser breaking
  md = unindentLists(md);

  // escape the characters that Tina's martkdown parser can't handle
  md = escapeInvalidChars(md);

  return md;
};

const unindentLists = (md) => {
  md = md.replace(/\r\n   -/g, '\r\n-');
  md = md.replace(/\r\n  -/g, '\r\n-');
  md = md.replace(/\r\n  ([0-9]+)./g, (match, capture) => {
    return `\r\n${capture}.`;
  });
  md = md.replace(/\r\n     ([0-9]+)./g, (match, capture) => {
    return `\r\n${capture}.`;
  });
  md = md.replace(/\r\n  \*/g, '\r\n*');
  md = md.replace(/\r\n   \*/g, '\r\n*');
  md = md.replace(/\r\n    ([0-9]+)./g, (match, capture) => {
    return `\r\n${capture}.`;
  });
  return md;
};

const escapeInvalidChars = (md) => {
  md = md.replace(/> -/g, '\\> \\-');
  md = md.replace(/>  -/g, '\\>  \\-');
  md = md.replace(/> */, '\\> \\*');
  md = md.replace(/> \*/, '\\> \\*');
  md = md.replace(/~~/g, '\\~\\~');
  md = md.replace(/{/g, '\\{');
  md = md.replace(/}/g, '\\}');
  md = md.replace(/!/g, '\\!');
  const matches = md.matchAll(/-{2,}/g);

  // escape each series of dashes (e.g. horizontal rules)
  // note: frontmatter is not included in the raw markdown body and does not need formatting
  for (let match of matches) {
    md = md.replace(match[0], `\\${match[0].split('').join('\\')}`);
  }
  return md;
};
