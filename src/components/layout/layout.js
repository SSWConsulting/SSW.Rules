import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { StaticQuery, graphql, navigate } from 'gatsby';
import Head from '../head/head';
import Header from '../header/header';
import Footer from '../footer/footer';
import '../../style.css';
import Menu from '../../../lib/ssw.megamenu/menu/menu';
import MobileMenu from '../../../lib/ssw.megamenu/mobile-menu/mobile-menu';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { AuthProvider } from 'oidc-react';
import { UserManager, WebStorageStateStore } from 'oidc-client';

config.autoAddCss = false;
const Layout = ({ children, displayActions, ruleUri, pageTitle }) => {
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

  const onRedirectCallback = (user) => {
    const returnUrl = sessionStorage.getItem('returnUrl') ?? '/';
    sessionStorage.removeItem('returnUrl');
    navigate(returnUrl);
  };

  const um = new UserManager({
    authority: process.env.B2C_AUTHORITY,
    client_id: process.env.B2C_CLIENT_ID,
    redirect_uri: process.env.B2C_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid https://sswrules.onmicrosoft.com/api/Read',
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    loadUserInfo: false,
  });

  return (
    <div
      style={{
        overflow: isMenuOpened ? 'hidden' : 'auto',
      }}
    >
      <AuthProvider
        userManager={um}
        onSignIn={onRedirectCallback}
        autoSignIn={false}
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
            <Head pageTitle={pageTitle} />
            <Header displayActions={displayActions} ruleUri={ruleUri} />
            <Menu onClickToggle={() => actionOnToggleClick()}></Menu>
            <main className="flex-1">{children}</main>
          </div>
          <Footer />
        </div>

        <MobileMenu isMenuOpened={isMenuOpened}></MobileMenu>
      </AuthProvider>
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
