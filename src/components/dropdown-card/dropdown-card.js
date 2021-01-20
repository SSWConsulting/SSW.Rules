import React from 'react';
import { navigate } from 'gatsby';
import PropTypes from 'prop-types';
import { faUser, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from 'oidc-react';

const DropdownCard = ({ setOpen }) => {
  const { userData, signOut } = useAuth();
  return (
    <>
      <div className="dropdown">
        <div className="dropdown-list">
          <p>Signed in as</p>
          <div
            style={{
              textAlign: 'start',
              margin: '1rem',
            }}
          >
            <p
              style={{
                fontWeight: 'bold',
                color: 'black',
                fontSize: 19,
              }}
            >
              @{userData.profile.name}
            </p>
            <a
              className="github-link"
              href={`https://www.github.com/${userData.profile.name}`}
            >
              Manage GitHub Account
            </a>
          </div>
          <hr />
          <button
            className="dropdown-btn-container"
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
          >
            <FontAwesomeIcon
              style={{ fontSize: '1.5rem', margin: '1rem' }}
              icon={faUser}
            />{' '}
            Your Profile
          </button>
          <button
            className="dropdown-btn-container"
            onClick={() => {
              signOut();
            }}
          >
            <FontAwesomeIcon
              style={{ fontSize: '1.5rem', margin: '1rem' }}
              icon={faSignOutAlt}
            />{' '}
            Sign Out
          </button>
        </div>
      </div>
      <div className="bubble-arrow">▲</div>
    </>
  );
};

DropdownCard.propTypes = {
  setOpen: PropTypes.func,
};

export default DropdownCard;
