import PropTypes, { object } from 'prop-types';
import React from 'react';
import { RulesWidget } from 'ssw.rules.widget';
import { RuleCountBlock } from './rule-count';
import { HistoryOfRulesBlock } from './history-of-rules';
import { CallToActionBlock } from './call-to-action';
import { useStaticQuery, graphql } from 'gatsby';

const SideBar = ({ blocks }) => {
  console.log('blocks', blocks);

  return (
    <section>
      <BlocksRenderer blocks={blocks} />
    </section>
  );
};

SideBar.propTypes = {
  blocks: PropTypes.arrayOf(object),
};

const BlocksRenderer = (props) => {
  return (
    <>
      {props.blocks
        ? props.blocks.map((block, index) => {
            switch (block._template) {
              case 'ruleCount':
                return (
                  <RuleCountBlock
                    key={index}
                    hideCount={false}
                    label={block.label}
                  />
                );
              case 'historyOfRules':
                return (
                  <HistoryOfRulesBlock
                    key={index}
                    label={block.label}
                    blurb={block.blurb}
                    improveOurRulesQuoteBlock={block.improveOurRulesQuoteBlock}
                  />
                );
              case 'latestRules':
                return (
                  <section key={index} id="widget">
                    {/*TODO: Fix this - Currently removing to stop this from working until this is fixed  */}
                    <RulesWidget />
                  </section>
                );
              case 'callToAction':
                return <CallToActionBlock key={index} />;
              default:
                return null;
            }
          })
        : null}
    </>
  );
};

const SidebarWithQuery = () => {
  const data = useStaticQuery(graphql`
    query SidebarQuery {
      allSswRulesContentJson {
        edges {
          node {
            blocks {
              _template
              label
              blurb
              improveOurRulesQuoteBlock {
                label
                quoteAuthorImage
                quoteAuthorName
                quoteAuthorTitle
                quoteAuthorUrl
              }
            }
          }
        }
      }
    }
  `);

  return <SideBar blocks={data.allSswRulesContentJson.edges[0].node.blocks} />;
};

export default SidebarWithQuery;
