import { useAuth0 } from '@auth0/auth0-react';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import DropdownIcon from '../dropdown-icon/dropdown-icon';
import {
  GetGithubOrganisations,
  setUserOrganisation,
} from '../../services/apiService';

const SignIn = ({ displayActions }) => {
  const {
    isAuthenticated,
    loginWithRedirect,
    user,
    getAccessTokenSilently,
  } = useAuth0();

  useEffect(() => {
    isAuthenticated ? setUserOrg() : null;
  });

  const setUserOrg = async () => {
    isAuthenticated
      ? await GetGithubOrganisations(user.name)
          .then(async (success) => {
            const token = await getAccessTokenSilently();
            success.forEach(async (org) => {
              const data = {
                OrganisationId: org.id.toString(),
                UserId: user.sub,
              };
              await setUserOrganisation(data, token).catch((err) => {
                console.error('error: ' + err);
              });
            });
          })
          .catch((err) => {
            console.error('error: ' + err);
          })
      : null;
  };
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
