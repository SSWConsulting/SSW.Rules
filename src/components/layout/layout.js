import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { StaticQuery, graphql, navigate } from 'gatsby';
import Head from '../head/head';
import Header from '../header/header';
import Footer from '../footer/footer';
import FloatingBubble from '../floating-bubble/floating-bubble';
import '../../style.css';
import { MobileMenu, Menu } from 'ssw.megamenu';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { Auth0Provider } from '@auth0/auth0-react';

config.autoAddCss = false;
const Layout = ({ children, displayActions, ruleUri, crumbLabel }) => {
  const node = useRef();
  const [isMenuOpened, setIsMenuOpened] = useState(false);

  const actionOnToggleClick = () => {
    setIsMenuOpened(!isMenuOpened);
  };

  const handleClick = (e) => {
    if (node.current.contains(e.target)) {
      setIsMenuOpened(false);
    }
  };

  const onRedirectCallback = (appState) => {
    navigate(appState.targetUrl);
  };

  return (
    <div
      style={{
        overflow: isMenuOpened ? 'hidden' : 'auto',
      }}
    >
      <Auth0Provider
        domain={process.env.AUTH0_DOMAIN}
        clientId={process.env.AUTH0_CLIENT_ID}
        redirectUri={process.env.AUTH0_REDIRECT_URI}
        onRedirectCallback={onRedirectCallback}
        useRefreshTokens={true}
        cacheLocation="localstorage"
      >
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          ref={node}
          onMouseDown={isMenuOpened ? (event) => handleClick(event) : null}
          style={{
            transform: isMenuOpened ? 'translateX(84%)' : 'translateX(0px)',
          }}
        >
          <div className="flex flex-col min-h-screen main-container">
            <Head
              pageTitle={
                crumbLabel == 'SSW Rules'
                  ? 'Secret ingredients to quality software'
                  : crumbLabel
              }
            />
            <Header displayActions={displayActions} ruleUri={ruleUri} />
            <Menu onClickToggle={() => actionOnToggleClick()}></Menu>
            <main className="flex-1">{children}</main>
          </div>
          <Footer />
        </div>

        <FloatingBubble linkToJump={'https://rulesgpt.ssw.com.au/'} />
        <MobileMenu isMenuOpened={isMenuOpened}></MobileMenu>
      </Auth0Provider>
    </div>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  data: PropTypes.object.isRequired,
  displayActions: PropTypes.bool.isRequired,
  ruleUri: PropTypes.string,
  pageTitle: PropTypes.string,
  crumbLocation: PropTypes.object,
  crumbLabel: PropTypes.string,
};

const LayoutWithQuery = (props) => (
  <StaticQuery
    query={graphql`
      query LayoutQuery {
        site {
          siteMetadata {
            siteTitle
          }
        }
      }
    `}
    render={(data) => <Layout data={data} {...props} />}
  />
);

LayoutWithQuery.propTypes = {
  children: PropTypes.node.isRequired,
};

export default LayoutWithQuery;
