import { useAuth0 } from '@auth0/auth0-react';
/* eslint-disable no-console */
import React from 'react';
import DropdownIcon from '../dropdown-icon/dropdown-icon';

const SignIn = () => {
  const { isAuthenticated, loginWithRedirect } = useAuth0();

  const currentPage =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/').pop()
      : null;

  return (
    <div className="action-btn-container">
      {!isAuthenticated ? (
        <button
          className="btn btn-red mr-0"
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
        <>
          <DropdownIcon />
        </>
      )}
    </div>
  );
};

export default SignIn;
