import PropTypes from 'prop-types';
import React from 'react';
import { RulesWidget } from 'ssw.rules.widget';
import { RuleCountBlock } from './rule-count';
import { HistoryOfRulesBlock } from './history-of-rules';
import { CallToActionBlock } from './call-to-action';

const SideBar = ({ ruleTotalNumber, hideCount }) => {
  return (
    <div>
      {/* TODO: https://github.com/SSWConsulting/SSW.Rules/issues/1553 */}
      <RuleCountBlock
        ruleTotalNumber={ruleTotalNumber}
        hideCount={hideCount}
        label="SSW Rules"
      />
      <section id="widget">
        {/*TODO: Fix this - Currently removing to stop this from working until this is fixed  */}
        <RulesWidget />
      </section>
      <HistoryOfRulesBlock
        label="Why all these rules?"
        improveOurRulesQuoteBlock={{
          label: 'Help improve our rules',
          quoteAuthorImage:
            'https://adamcogan.com/wp-content/uploads/2018/07/adam-bw.jpg',
          quoteAuthorName: 'Adam Cogan',
          quoteAuthorTitle: 'Chief Software Architect at SSW',
          quoteAuthorUrl: 'https://www.ssw.com.au/people/adam-cogan',
        }}
      />
      <CallToActionBlock />
    </div>
  );
};

SideBar.propTypes = {
  ruleTotalNumber: PropTypes.number.isRequired,
  hideCount: PropTypes.bool,
};

export default SideBar;
