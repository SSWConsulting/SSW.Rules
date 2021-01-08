import { useAuth } from 'oidc-react';
import React from 'react';

const SignIn = () => {
  const { signIn, signOut, userData } = useAuth();
  const currentPage =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/').pop()
      : null;

  return (
    <div className="action-btn-container">
      {userData && <Profile />}
      {!userData ? (
        <button
          className="btn btn-red"
          onClick={() => {
            sessionStorage.setItem('returnUrl', currentPage);
            signIn();
          }}
        >
          Log in
        </button>
      ) : (
        <button
          className="btn btn-red"
          onClick={() => {
            signOut();
          }}
        >
          Log out
        </button>
      )}
    </div>
  );
};

const Profile = () => {
  const {
    userData: { profile },
  } = useAuth();

  return <div>Welcome, {profile.name}</div>;
};

export default SignIn;
