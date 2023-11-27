import React from 'react';
import PropTypes from 'prop-types';
import posed from 'react-pose';
import Tooltip from '../tooltip/tooltip';
import SSWLogo from '-!svg-react-loader!../../images/SSWLogo.svg';
import GPTIcon from '-!svg-react-loader!../../images/chatgpt_icon.svg';
import SignIn from '../signin/signin';
import { parentSiteUrl, pathPrefix } from '../../../site-config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusCircle,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

appInsights.loadAppInsights();

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
        <div className="mt-4 mb-3 flex">
          <div className="column">
            <div className="flex items-center">
              <a
                href={parentSiteUrl}
                className="ssw-logo unstyled cursor-pointer"
              >
                <SSWLogo aria-label="logo" width="113.5" height="75.5" />
              </a>
              <div className="my-4 leading-[1.2] ml-2 text-[2.5rem]">
                <a href="/rules">Rules</a>
              </div>
            </div>
            <p className={displayActions ? 'tagline-hidden' : 'tagline'}>
              Secret ingredients to quality software
            </p>
          </div>
          <div className="action-btn-container flex justify-items-end align-middle">
            <Tooltip text="Try out RulesGPT" showDelay={3000} hideDelay={18000}>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://rulesgpt.ssw.com.au"
                className="action-btn-link-underlined"
                onClick={() => {
                  appInsights.trackEvent({
                    name: 'RulesGPTButtonPressed',
                  });
                }}
              >
                <GPTIcon className="group group-hover:[&>circle]:fill-ssw-red" />
              </a>
            </Tooltip>

            <Tooltip text="Create an SSW Rule">
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`${pathPrefix}/admin/#/collections/rule/new`}
                className="action-btn-link-underlined"
              >
                <FontAwesomeIcon
                  icon={faPlusCircle}
                  className="header-icon"
                  size="2x"
                />
              </a>
            </Tooltip>

            <Tooltip text="SSW Rules wiki">
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
