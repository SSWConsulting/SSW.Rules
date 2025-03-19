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
        // Change theme value to "light" after GitHub fixes issue for upvote feature - https://github.com/SSWConsulting/SSW.Rules/issues/1686
        theme="https://sarulesstagbbfslamgwndh2.blob.core.windows.net/giscus-theme/giscus-theme.css"
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
