import React from 'react';
import PropTypes from 'prop-types';
import posed from 'react-pose';
import SSWLogo from '-!svg-react-loader!../../images/SSWLogo.svg';
import InfoIcon from '-!svg-react-loader!../../images/info.svg';
import SignIn from '../signin/signin';
import { parentSiteUrl } from '../../../site-config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';

// Example of a component-specific page transition
const AnimatedContainer = posed.div({
  enter: {
    y: 0,
    transition: {
      ease: 'easeInOut',
    },
  },
  exit: {
    y: '-100%',
    transition: {
      ease: 'easeInOut',
    },
  },
});
const Header = ({ displayActions }) => {
  return (
    <AnimatedContainer>
      <header>
        <div className="flex mt-4 mb-3">
          <div className="column">
            <div className="flex items-center">
              <a
                href={parentSiteUrl}
                className="ssw-logo unstyled cursor-pointer"
              >
                <SSWLogo aria-label="logo" width="113.5" height="75.5" />
              </a>
              <h1 className="title ml-2">Rules</h1>
            </div>
            <p className={displayActions ? 'tagline-hidden' : 'tagline'}>
              Secret ingredients to quality software
            </p>
          </div>
          <div className="action-btn-container">
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://www.ssw.com.au/rules/admin/#/collections/rule/new"
              className="action-btn-link-underlined"
            >
              <div>New Rule</div>
              <FontAwesomeIcon
                icon={faPlusCircle}
                className="ml-1"
              ></FontAwesomeIcon>
            </a>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://rules.ssw.com.au/make-your-site-easy-to-maintain"
              className="action-btn-link-underlined"
            >
              <div>Info</div>
              <InfoIcon aria-label="logo" className="action-btn-icon" />
            </a>
            <SignIn />
          </div>
        </div>
      </header>
    </AnimatedContainer>
  );
};

Header.propTypes = {
  displayActions: PropTypes.bool.isRequired,
  ruleUri: PropTypes.string,
};

export default Header;
