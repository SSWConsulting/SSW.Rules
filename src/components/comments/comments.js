import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { commentsRepository, commentsTheme } from '../../../site-config';

export default class Comments extends Component {
  constructor(props) {
    super(props);
    this.commentBox = React.createRef();
  }

  componentDidMount() {
    let scriptEl = document.createElement('script');
    scriptEl.setAttribute('src', 'https://utteranc.es/client.js');
    scriptEl.setAttribute('crossorigin', 'anonymous');
    scriptEl.setAttribute('async', true);
    scriptEl.setAttribute('repo', commentsRepository);
    scriptEl.setAttribute('issue-term', this.props.guid);
    scriptEl.setAttribute('theme', commentsTheme);
    this.commentBox.current.appendChild(scriptEl);
  }

  render() {
    return (
      <div className="comment-box-wrapper container pt-70">
        <hr className="comment-seperator" />
        <div ref={this.commentBox} className="comment-box" />
      </div>
    );
  }
}

Comments.propTypes = {
  guid: PropTypes.string,
};
