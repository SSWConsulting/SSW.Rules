import { useAuth } from 'oidc-react';
import React from 'react';
import PropTypes from 'prop-types';
import PlaceHolderImage from '../../images/ssw-employee-profile-placeholder-sketch.jpg';

const DropdownBadge = ({ onClick }) => {
  const { userData } = useAuth();

  const { profile } = userData ? userData : null;

  return (
    <button
      className="flex flex-row flex-wrap justify-center profile-container-img"
      onClick={onClick}
    >
      <div className="dropdown-badge" key={`user_${profile.name}`}>
        <ProfileImage user={profile.name} />
      </div>
    </button>
  );
};

DropdownBadge.propTypes = {
  onClick: PropTypes.func,
};

function ProfileImage(props) {
  const user = props.user;
  if (user) {
    return (
      <img
        src={`https://avatars.githubusercontent.com/${user}`}
        alt={user}
        title={user}
      />
    );
  } else {
    return <img src={PlaceHolderImage} alt={user} title={user} />;
  }
}

ProfileImage.propTypes = {
  user: PropTypes.any,
};

export default DropdownBadge;
