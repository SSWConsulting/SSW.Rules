// Netlify CMS exposes two React method "createClass" and "h"
import React from 'react';
import markdownIt from 'markdown-it';

import { format } from 'date-fns';
import PropTypes from 'prop-types';

import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// customize markdown-it
let options = {
  html: true,
  typographer: true,
  linkify: true,
};

var customMarkdownIt = new markdownIt(options);
customMarkdownIt.use(require('markdown-it-container'), 'classname', {
  validate: (name) => name.trim().length,
  render: (tokens, idx) => {
    console.log(tokens[idx].nesting);
    if (tokens[idx].nesting === 1) {
      return `<div class="${tokens[idx].info.trim()}">\n`;
    } else {
      return '</div>\n';
    }
  },
});

var PreviewTemplate = ({ entry }) => {
  const title = entry.getIn(['data', 'title'], null);
  const body = entry.getIn(['data', 'body'], null);
  const created = entry.getIn(['data', 'created'], null);
  const archivedReason = entry.getIn(['data', 'archivedreason'], null);
  const bodyRendered = customMarkdownIt.render(body || '');

  return (
    <body>
      <main>
        <article className="rule-content editor-preview">
          <h1 style={{ fontSize: '2.25rem' }}>{title}</h1>
          <small className="history">
            Created on {format(new Date(created), 'dd MMM yyyy')} | Last updated
            by <strong>USER NAME </strong> now
          </small>
          {archivedReason && archivedReason.length > 0 && (
            <div>
              <br />
              <div className="attention archived px-4">
                <FontAwesomeIcon
                  icon={faExclamationTriangle}
                  className="attentionIcon"
                />{' '}
                This rule has been archived
              </div>
              <div className="RuleArchivedReasonContainer px-4">
                <span className="ReasonTitle">Archived Reason: </span>
                {archivedReason}
              </div>
            </div>
          )}
          <hr />
          <div dangerouslySetInnerHTML={{ __html: bodyRendered }} />
          <div>{bodyRendered}</div>
        </article>
      </main>
    </body>
  );
};

PreviewTemplate.propTypes = {
  entry: PropTypes.any.isRequired,
};

export default PreviewTemplate;
