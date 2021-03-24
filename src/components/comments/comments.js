import { Disqus, CommentCount } from 'gatsby-plugin-disqus';
import React from 'react';
import PropTypes from 'prop-types';

const PostTemplate = (props) => {
  let disqusConfig = {
    // url: `${'localhost:9000' + location.pathname}`,
    identifier: props.ruleGuid,
    title: props.title,
  };
  return (
    <div
      style={{
        marginBottom: '5rem',
        padding: '1rem 1.5rem',
      }}
    >
      <hr className="pb-4" />
      {/* <CommentCount config={disqusConfig} placeholder={'No comments yet'} /> */}
      <Disqus config={disqusConfig} />
    </div>
  );
};

export default PostTemplate;

PostTemplate.propTypes = {
  uri: PropTypes.string.isRequired,
  ruleGuid: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};
