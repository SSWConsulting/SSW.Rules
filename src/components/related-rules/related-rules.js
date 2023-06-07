import React from 'react';
import { Link } from 'gatsby';
import PropTypes from 'prop-types';

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
          <ul className="text-sm px-2 lg:mb-20">
            {filteredRelatedRules.map((relatedUri, index) => {
              return (
                <li className="ml-5 mb-2" key={index}>
                  <Link to={`/${relatedUri.frontmatter.uri}`}>
                    {relatedUri.frontmatter.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
};

RelatedRules.propTypes = {
  relatedRules: PropTypes.object,
  relatedRulesFromRedirects: PropTypes.object,
  rule: PropTypes.object,
};

export default RelatedRules;
