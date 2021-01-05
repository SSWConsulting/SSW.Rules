import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';
import { withPrefix } from 'gatsby';

const SignIn = () => {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();

  return (
    <div className="action-btn-container">
      {user && <Profile />}
      {!isAuthenticated ? (
        <button
          className="btn btn-red"
          onClick={() => {
            loginWithRedirect({
              appState: { targetUrl: withPrefix(window.location.pathname) },
            });
          }}
        >
          Log in
        </button>
      ) : (
        <button
          className="btn btn-red"
          onClick={() => {
            logout({ returnTo: process.env.AUTH0_REDIRECT_URI });
          }}
        >
          Log out
        </button>
      )}
    </div>
  );
};

const Profile = () => {
  const { user } = useAuth0();

  return <div>Welcome, {user.name}</div>;
};

export default SignIn;
