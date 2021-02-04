import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';
import PropTypes from 'prop-types';
import PlaceHolderImage from '../../images/ssw-employee-profile-placeholder-sketch.jpg';

const ProfileBadge = () => {
  const { user } = useAuth0();
  const { profile } = user ? user : null;

  return (
    <button className="flex flex-row flex-wrap justify-center profile-container-img">
      <div className="profile-badge" key={`user_${profile.name}`}>
        <ProfileImage user={profile.name} />
      </div>
    </button>
  );
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

export default ProfileBadge;
