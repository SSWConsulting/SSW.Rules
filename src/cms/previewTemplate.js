// Netlify CMS exposes two React method "createClass" and "h"
import React from 'react';
import markdownIt from 'markdown-it';

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
    if (tokens[idx].nesting === 1) {
      return `<div class="${tokens[idx].info.trim()}">\n`;
    } else {
      return '</div>\n';
    }
  },
});

var PreviewTemplate = ({ entry, getAsset }) => {
  const title = entry.getIn(['data', 'title'], null);
  const body = entry.getIn(['data', 'body'], null);
  const archivedReason = entry.getIn(['data', 'archivedreason'], null);
  customMarkdownIt.renderer.rules.image = function (tokens, idx) {
    var token = tokens[idx];
    return `
      <figure class="image">
        <img src=${getAsset(token.attrs[0][1]).url} alt=${token.attrs[1][1]}/>
        <figcaption>
          <strong>${token.attrs[1][1]}Figure: My image
          </strong>
        </figcaption>
      </figure>`;
  };

  customMarkdownIt.renderer.rules.code_inline = function (tokens, idx) {
    var token = tokens[idx];
    if (token.content.startsWith('youtube: ')) {
      const url = token.content.replace('youtube: ', '');
      const videoId = url.substring(url.lastIndexOf('/') + 1);

      return `<iframe
          scrolling="no"
          width="788.54"
          height="443"
          type="text/html"
          src="https://www.youtube-nocookie.com/embed/${videoId}"
        ></iframe>`;
    } else {
      return token.content;
    }
  };

  const bodyRendered = customMarkdownIt.render(body || '');
  return (
    <body>
      <main>
        <article className="rule-content editor-preview">
          <h1 className="rule-heading">{title}</h1>
          {archivedReason && archivedReason.length > 0 && (
            <div>
              <br />
              <div className="attention archived px-4">
                <FontAwesomeIcon
                  icon={faExclamationTriangle}
                  className="attention.archived"
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
        </article>
      </main>
    </body>
  );
};

PreviewTemplate.propTypes = {
  entry: PropTypes.any.isRequired,
  getAsset: PropTypes.func.isRequired,
};

export default PreviewTemplate;
