import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';

const SignIn = () => {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();

  return (
    <div className="action-btn-container">
      {user && <Profile />}
      {!isAuthenticated ? (
        <button className="btn btn-red" onClick={loginWithRedirect}>
          Log in
        </button>
      ) : (
        <button
          className="btn btn-red"
          onClick={() => {
            logout({ returnTo: window.location.origin });
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
