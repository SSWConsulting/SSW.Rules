import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useStaticQuery, graphql, navigate } from 'gatsby';
import Head from '../head/head';
import Header from '../header/header';
import Footer from '../footer/footer';
import '../../style.css';
import { config } from '@fortawesome/fontawesome-svg-core';
import { Auth0Provider } from '@auth0/auth0-react';
import '@fortawesome/fontawesome-svg-core/styles.css';

config.autoAddCss = false;
const Layout = ({
  children,
  displayActions,
  ruleUri,
  crumbLabel,
  pageDescription,
}) => {
  const node = useRef();
  const [isMenuOpened, setIsMenuOpened] = useState(false);

  const handleClick = (e) => {
    if (node.current.contains(e.target)) {
      setIsMenuOpened(false);
    }
  };

  const onRedirectCallback = (appState) => {
    navigate(appState.targetUrl);
  };

  return (
    <div className="overflow-hidden md:overflow-auto lg:overflow-visible">
      <Auth0Provider
        domain={process.env.AUTH0_DOMAIN}
        clientId={process.env.AUTH0_CLIENT_ID}
        authorizationParams={{
          redirect_uri: process.env.AUTH0_REDIRECT_URI,
        }}
        // redirectUri={process.env.AUTH0_REDIRECT_URI}
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
                crumbLabel == 'SSW Rules' ? 'Latest Rules' : crumbLabel
              }
              pageDescription={pageDescription}
            />
            <Header displayActions={displayActions} ruleUri={ruleUri} />
            <main className="flex-1">{children}</main>
          </div>
          <Footer />
        </div>
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
  pageDescription: PropTypes.string,
};

function LayoutWithQuery(props) {
  const data = useStaticQuery(graphql`
    query LayoutQuery {
      site {
        siteMetadata {
          siteTitle
        }
      }
    }
  `);

  return <Layout data={data} {...props} />;
}

LayoutWithQuery.propTypes = {
  children: PropTypes.node.isRequired,
};

export default LayoutWithQuery;
