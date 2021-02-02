import { useAuth } from 'oidc-react';
import React, { useEffect, useState } from 'react';
import DropdownIcon from '../dropdown-icon/dropdown-icon';

const SignIn = ({ displayActions }) => {
  const { signIn, userData } = useAuth();
  const currentPage =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/').pop()
      : null;

  return (
    <div className="action-btn-container">
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
        <>
          <DropdownIcon displayActions={displayActions} />
        </>
      )}
    </div>
  );
};

export default SignIn;
