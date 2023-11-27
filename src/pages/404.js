import { Link } from 'gatsby';
import React from 'react';
import { pathPrefix } from '../site-config';

const NotFound = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-grid">
        <h1 className="unselectable">404</h1>
        <div className="not-found-message">
          <h2 className="unselectable">
            The verdict is in... <br />
            SSW Rules has concluded that this page is <span>NOT FOUND!</span>
          </h2>
        </div>
        <div className="not-found-greybox greybox">
          Visit <Link to="/">SSW Rules homepage</Link> and find out more secret
          ingredients to quality software.
        </div>
        <div className="not-found-greybox greybox">
          Learn more about{' '}
          <a href={`${pathPrefix}/404-useful-error-page`}>
            having a useful 404 error page.
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
