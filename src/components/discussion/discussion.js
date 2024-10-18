import Giscus from '@giscus/react';
import React from 'react';
import PropTypes from 'prop-types';

const Discussion = (props) => {
  return (
    <div className="discussion-box">
      <Giscus
        id="comments"
        repo="SSWConsulting/SSW.Rules"
        repoId={process.env.GISCUS_REPO_ID}
        category="General"
        categoryId={process.env.GISCUS_CATEGORY_ID}
        mapping="specific"
        term={props.ruleGuid}
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="bottom"
        theme="light"
        lang="en"
        loading="lazy"
        async
      />
    </div>
  );
};

export default Discussion;

Discussion.propTypes = {
  ruleGuid: PropTypes.string.isRequired,
};
