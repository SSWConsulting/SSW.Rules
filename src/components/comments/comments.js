import { Disqus } from 'gatsby-plugin-disqus';
import React from 'react';
import PropTypes from 'prop-types';

const Comments = (props) => {
  let disqusConfig = {
    identifier: props.ruleGuid,
    title: props.title,
  };
  return (
    <div className="discussion-box">
      <h3>⏳ Disqus comments</h3>
      <Disqus config={disqusConfig} />
    </div>
  );
};

export default Comments;

Comments.propTypes = {
  uri: PropTypes.string.isRequired,
  ruleGuid: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};
