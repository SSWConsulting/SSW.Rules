import React from 'react';
import { navigate } from 'gatsby';
import PropTypes from 'prop-types';
import { useAuth } from 'oidc-react';
import GitHubIcon from '-!svg-react-loader!../../images/github.svg';

const DropdownCard = ({ setOpen, displayActions }) => {
  const { userData, signOut } = useAuth();
  return (
    <>
      <div
        className={displayActions ? 'dropdown-list-center ' : 'dropdown-list'}
      >
        <div className="dropdown-userinfo-container">
          <p className="dropdown-username">@{userData.profile.name}</p>
          <a
            className="github-link"
            href={`https://www.github.com/${userData.profile.name}`}
          >
            <GitHubIcon className="dropdown-github-icon" />
            Manage GitHub Account
          </a>
        </div>
        <hr />
        <button
          className="dropdown-user-btn-container"
          onClick={() => {
            setOpen(false);
            navigate('/profile');
          }}
        >
          Your Profile
        </button>
        <button
          className="dropdown-signout-btn-container"
          onClick={() => {
            signOut();
          }}
        >
          Sign Out
        </button>
      </div>
      <div className="bubble-arrow">▲</div>
    </>
  );
};

DropdownCard.propTypes = {
  setOpen: PropTypes.func,
};

export default DropdownCard;
