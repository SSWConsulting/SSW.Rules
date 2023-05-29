import React from 'react';
import { Link } from 'gatsby';

const RelatedRules = ({ relatedRules, relatedRulesFromRedirects, rule }) => {
  const RelatedRuleArr = rule.frontmatter.related || [];

  const filteredRelatedRules = RelatedRuleArr.map((uri) => {
    let relatedRule = relatedRules.nodes.find((r) => r.frontmatter.uri === uri);

    if (!relatedRule) {
      relatedRule = relatedRulesFromRedirects.nodes.find((r) => {
        return r.frontmatter.redirects && r.frontmatter.redirects.includes(uri);
      });
    }
    return relatedRule;
  }).filter((item) => item !== undefined);

  return (
    <>
      {filteredRelatedRules && filteredRelatedRules.length > 0 && (
        <div className="flex flex-col items-center">
          <ol className="text-sm">
            {filteredRelatedRules.map((relatedUri, index) => {
              return (
                <li className="ml-5 mb-3" key={index}>
                  <span className="text-ssw-red mr-2">{index + 1}.</span>
                  <Link to={`/${relatedUri.frontmatter.uri}`}>
                    {relatedUri.frontmatter.title}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </>
  );
};

export default RelatedRules;
