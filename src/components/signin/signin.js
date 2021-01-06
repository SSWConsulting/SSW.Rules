import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';

const SignIn = () => {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();
  const currentPage =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/').pop()
      : null;

  return (
    <div className="action-btn-container">
      {user && <Profile />}
      {!isAuthenticated ? (
        <button
          className="btn btn-red"
          onClick={() => {
            loginWithRedirect({
              appState: {
                targetUrl: currentPage,
              },
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
