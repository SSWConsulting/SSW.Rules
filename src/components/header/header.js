import React from 'react';
import PropTypes from 'prop-types';
import posed from 'react-pose';
import Tooltip from '../tooltip/tooltip';
import SSWLogo from '-!svg-react-loader!../../images/SSWLogo.svg';
import SignIn from '../signin/signin';
import { parentSiteUrl } from '../../../site-config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusCircle,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';

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
              <a href="/rules">
                <h1 className="title unselectable ml-2">Rules</h1>
              </a>
            </div>
            <p className={displayActions ? 'tagline-hidden' : 'tagline'}>
              Secret ingredients to quality software
            </p>
          </div>
          <div className="action-btn-container flex justify-items-end align-middle">
            <Tooltip text="Add New Rule">
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://www.ssw.com.au/rules/admin/#/collections/rule/new"
                className="action-btn-link-underlined"
              >
                <FontAwesomeIcon
                  icon={faPlusCircle}
                  className="header-icon"
                  size="2x"
                />
              </a>
            </Tooltip>

            <Tooltip text="How to Edit Rules">
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://github.com/SSWConsulting/SSW.Rules.Content/wiki"
                className="action-btn-link-underlined"
              >
                <FontAwesomeIcon
                  icon={faQuestionCircle}
                  className="header-icon"
                  size="2x"
                />
              </a>
            </Tooltip>
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
