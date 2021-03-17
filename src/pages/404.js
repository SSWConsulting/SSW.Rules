import { Link, navigate } from 'gatsby';
import React from 'react';

const NotFound = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-grid">
        <h1>404</h1>
        <div className="not-found-message">
          <h2>
            Sorry, the page you&#39;re looking for has been found...{' '}
            <span>NOT FOUND!</span>
          </h2>
          <p>
            Visit our <Link to="/">Rules Index</Link> to find out more secret
            ingredients to quality software or{' '}
            <button onClick={() => navigate(-1)}>go back</button> to the
            previous page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
