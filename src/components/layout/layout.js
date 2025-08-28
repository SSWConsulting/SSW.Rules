import { Auth0Provider } from '@auth0/auth0-react';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { graphql, navigate, useStaticQuery } from 'gatsby';
import PropTypes from 'prop-types';
import React, { useRef, useState } from 'react';
import '../../style.css';
import Footer from '../footer/footer';
import Head from '../head/head';
import Header from '../header/header';

config.autoAddCss = false;
const Layout = ({
  data,
  children,
  displayActions,
  ruleUri,
  crumbLabel,
  seoDescription,
  location,
}) => {
  const isHomePage =
    location?.href &&
    location?.href.match(/^https:\/\/www\.ssw\.com\.au\/rules\/{0,1}$/);
  const description = isHomePage
    ? data?.site?.siteMetadata.homePageDescription
    : seoDescription;
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
          audience: process.env.AUTH0_AUDIENCE,
          scope: process.env.AUTH0_SCOPE
        }}
        onRedirectCallback={onRedirectCallback}
        useRefreshTokens={true}
        cacheLocation="localstorage"
        useRefreshTokensFallback={true}
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
            <Head pageTitle={crumbLabel} seoDescription={description} />
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
  seoDescription: PropTypes.string,
  location: {
    href: PropTypes.string,
  },
};

function LayoutWithQuery(props) {
  const data = useStaticQuery(graphql`
    query LayoutQuery {
      site {
        siteMetadata {
          siteTitle
          homePageDescription
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
