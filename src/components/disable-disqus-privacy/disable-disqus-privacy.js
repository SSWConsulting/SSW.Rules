import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

import PrivacyToggle from '../../images/privacyToggle.png';

const DisableDisqusPrivacy = ({ userCommentsConnected, listChange }) => {
  useEffect(() => {}, [userCommentsConnected, listChange]);
  return (
    <>
      <div className="warning-box">
        SSW Rules cant see your comments!
        <p />
        Please go to your{' '}
        <a
          href="https://disqus.com/home/settings/profile/"
          className="disqus-profile-link"
          target="_blank"
          rel="noreferrer"
        >
          Disqus Profile{' '}
        </a>
        and disable <b>&#34;Keep your profile activity private&#34;</b>
      </div>
      <figure className="privacy-toggle-figure">
        <img
          src={PrivacyToggle}
          alt="Screenshot of privacy toggle"
          className="privacy-toggle-image"
        />
        <figcaption className="privacy-toggle-caption">
          Figure: Location of the privacy toggle (This is usually disabled by
          default)
        </figcaption>
      </figure>
    </>
  );
};

DisableDisqusPrivacy.propTypes = {
  userCommentsConnected: PropTypes.bool,
  listChange: PropTypes.number,
};

export default DisableDisqusPrivacy;
