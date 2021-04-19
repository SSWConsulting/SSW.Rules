import { Disqus } from 'gatsby-plugin-disqus';
import React from 'react';
import PropTypes from 'prop-types';

const Comments = (props) => {
  let disqusConfig = {
    identifier: props.ruleGuid,
    title: props.title,
  };
  return (
    <div className="disqus-box">
      <hr className="pb-4" />
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
