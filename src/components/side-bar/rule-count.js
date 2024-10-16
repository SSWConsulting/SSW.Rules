import React from 'react';
//.JS file needed for this Import...
import GavelIcon from '-!svg-react-loader!../../images/gavel.svg';
import { NumericFormat } from 'react-number-format';
import { useStaticQuery, graphql } from 'gatsby';

export const RuleCountBlock = ({ hideCount, label }) => {
  const data = useStaticQuery(graphql`
    query RuleCountQuery {
      rules: allMarkdownRemark(
        filter: { frontmatter: { type: { eq: "rule" } } }
      ) {
        totalCount
      }
    }
  `);

  return (
    <section className="rules-counter">
      {!hideCount && (
        <div className="grid grid-cols-6">
          <div className="col-span-1 col-start-2">
            <GavelIcon className="gavel-icon" />
          </div>
          <div className="col-span-2">
            <div className="text-3xl font-semibold text-ssw-red">
              <NumericFormat
                value={data.rules.totalCount}
                displayType={'text'}
                thousandSeparator={true}
              />
            </div>
            <p>{label}</p>
          </div>
        </div>
      )}
    </section>
  );
};
