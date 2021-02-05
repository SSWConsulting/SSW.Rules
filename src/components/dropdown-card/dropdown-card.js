import React from 'react';
import { navigate } from 'gatsby';
import PropTypes from 'prop-types';
import { useAuth0 } from '@auth0/auth0-react';
import GitHubIcon from '-!svg-react-loader!../../images/github.svg';

const DropdownCard = ({ setOpen, displayActions }) => {
  const { logout, user } = useAuth0();
  return (
    <>
      <div
        className={displayActions ? 'dropdown-list-center ' : 'dropdown-list'}
      >
        <div className="dropdown-userinfo-container">
          <p className="dropdown-username">@{user.nickname}</p>
          <a
            className="github-link"
            href={`https://www.github.com/${user.nickname}`}
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
            logout({ returnTo: process.env.AUTH0_REDIRECT_URI });
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
  displayActions: PropTypes.bool,
};

export default DropdownCard;
