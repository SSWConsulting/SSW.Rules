import { useAuth0, Auth0Provider } from '@auth0/auth0-react';
import React from 'react';

const SignIn = () => {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();
  user && console.log(user);

  function signin() {
    loginWithRedirect();
  }

  function signout() {
    logout({ returnTo: window.location.origin });
  }

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
            logout({ returnTo: 'http://localhost:3000' });
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

const Status = () => {
  const { isLoading, error } = useAuth0();

  if (isLoading) {
    return <div>Loading...</div>;
  } else if (error) {
    return <div>Oops... {error.message}</div>;
  }
  return <></>;
};

export default SignIn;
