import { useAuth0 } from '@auth0/auth0-react';
import { navigate } from 'gatsby';
import PropTypes from 'prop-types';
import React from 'react';

const DropdownCard = ({ setOpen }) => {
  const { logout, user } = useAuth0();
  return (
    <>
      <div className="dropdown-list">
        <p className="dropdown-username">@{user.nickname}</p>
        <button
          className="dropdown-btn dropdown-icon dropdown-github-icon"
          onClick={() => {
            setOpen(false);
            window.open(`https://www.github.com/${user.nickname}`);
          }}
        >
          GitHub Profile
        </button>
        <button
          className="dropdown-btn dropdown-icon dropdown-user-icon"
          onClick={() => {
            setOpen(false);
            navigate('/profile');
          }}
        >
          SSW.Rules Profile
        </button>
        <hr />
        <button
          className="dropdown-btn dropdown-icon dropdown-signout-icon"
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
};

export default DropdownCard;
