import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';
import PropTypes from 'prop-types';
import DropdownIcon from '../dropdown-icon/dropdown-icon';

const SignIn = ({ displayActions }) => {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const currentPage =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/').pop()
      : null;

  return (
    <div className="action-btn-container">
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
        <>
          <DropdownIcon displayActions={displayActions} />
        </>
      )}
    </div>
  );
};

SignIn.propTypes = {
  displayActions: PropTypes.bool,
};

export default SignIn;
