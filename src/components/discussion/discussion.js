import Giscus from '@giscus/react';
import React from 'react';
import PropTypes from 'prop-types';

const Discussion = (props) => {
  return (
    <div className="discussion-box mb-20 px-6 pb-4">
      <Giscus
        id="comments"
        repo={process.env.GISCUS_REPO_NAME}
        repoId={process.env.GISCUS_REPO_ID}
        categoryId={process.env.GISCUS_CATEGORY_ID}
        mapping="specific"
        strict="1"
        term={props.ruleGuid}
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="top"
        theme="https://cdn.statically.io/gh/SSWConsulting/SSW.Rules/main/static/giscus-theme.css"
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
