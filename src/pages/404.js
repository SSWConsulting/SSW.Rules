import { Link } from 'gatsby';
import React from 'react';

const NotFound = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-grid">
        <h1>404</h1>
        <div className="not-found-message">
          <h2>
            Sorry, the page you're looking for has been found...{' '}
            <b>NOT FOUND!</b>
          </h2>
          <p>
            Visit our <Link to="/">Rules Index</Link> to find out more secret
            ingredients to quality software or <Link to="/">go back</Link> to
            the previous page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
