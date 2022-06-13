import { Link, navigate } from 'gatsby';
import React from 'react';

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
          Visit <Link to="/">SSW Rules homepage</Link> and find out more secret ingredients to quality software; or{' '}
          <button onClick={() => navigate(-1)}>go back</button> to the previous page.
        </div>
        <div className="not-found-greybox greybox">
          This page is as per{' '}
          <a href="https://ssw.com.au/rules/404-useful-error-page">
            Do you replace the 404 error with a useful error page?
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
