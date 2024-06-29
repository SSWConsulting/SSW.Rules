import { Giscus } from '@giscus/react';
import React from 'react';
import PropTypes from 'prop-types';

const GISCUS_REPO_ID = process.env.GISCUS_REPO_ID;

const Comments = () => {
  return (
    <>
      <div className="disqus-box">
        <Giscus
          id="comments"
          repo="SSWConsulting/SSW.Rules"
          repoId={GISCUS_REPO_ID}
          category="General"
          categoryId="DIC_kwDOD1jvwM4B_y_I"
          mapping="pathname"
          term="Welcome to SSW Rules"
          reactionsEnabled="1"
          emitMetadata="0"
          inputPosition="top"
          theme="light"
          lang="en"
          loading="lazy"
          async
        />
      </div>
    </>
  );
};

export default Comments;

Comments.propTypes = {
  uri: PropTypes.string.isRequired,
  ruleGuid: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};
