import React from 'react';
import { navigate } from 'gatsby';
import PropTypes from 'prop-types';
import { faUser, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from 'oidc-react';
import GitHubIcon from '-!svg-react-loader!../../images/github.svg';

const DropdownCard = ({ setOpen }) => {
  const { userData, signOut } = useAuth();
  return (
    <>
      <div className="dropdown">
        <div className="dropdown-list">
          <div
            style={{
              textAlign: 'start',
              margin: '1rem 1rem',
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
              <GitHubIcon style={{ margin: '0.15rem 0.2rem 0rem 0rem' }} />
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
              style={{ fontSize: '1.5rem', margin: '0.7rem 1rem' }}
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
              style={{ fontSize: '1.5rem', margin: '0.7rem 1rem' }}
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
