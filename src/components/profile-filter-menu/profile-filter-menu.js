/* eslint-disable no-console */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  GetLikesDislikesCountForUser,
  GetBookmarksCountForUser,
} from '../../services/apiService';
import { useAuth } from 'oidc-react';

const ProfileFilterMenu = ({ selectedFilter, setSelectedFilter, change }) => {
  const { userData } = useAuth();
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDisikesCount] = useState(0);
  const [bookmarksCount, setBookmarksCount] = useState(0);

  useEffect(() => {
    if (userData) {
      GetLikesDislikesCountForUser(userData.profile.sub)
        .then((success) => {
          console.log(success);
          setLikesCount(success.likeCount ?? 0);
          setDisikesCount(success.dislikeCount ?? 0);
        })
        .catch((err) => {
          console.error('error', err);
        });
      GetBookmarksCountForUser(userData.profile.sub)
        .then((success) => {
          console.log(success);
          setBookmarksCount(success.bookmarksCount ?? 0);
        })
        .catch((err) => {
          console.error('error', err);
        });
    }
  }, [userData, selectedFilter, change]);

  return (
    <>
      <div className="filter-menu">
        <div
          className="menu-item"
          style={
            selectedFilter == Filter.Bookmarks
              ? {
                  gridColumn: 1,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 1 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Bookmarks);
          }}
        >
          Bookmarks
          <div style={{ opacity: '70%', paddingLeft: '0.5rem' }}>
            {bookmarksCount}
          </div>
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == Filter.Likes
              ? {
                  gridColumn: 2,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 2 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Likes);
          }}
        >
          Likes
          <div
            style={{ opacity: '70%', color: 'green', paddingLeft: '0.5rem' }}
          >
            {likesCount}
          </div>
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == Filter.Dislikes
              ? {
                  gridColumn: 3,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 3 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Dislikes);
          }}
        >
          Dislikes
          <div
            style={{
              opacity: '70%',
              color: '#cc4141',
              paddingLeft: '0.5rem',
            }}
          >
            {dislikesCount}
          </div>
        </div>
      </div>
    </>
  );
};

ProfileFilterMenu.propTypes = {
  selectedFilter: PropTypes.number.isRequired,
  setSelectedFilter: PropTypes.func.isRequired,
  change: PropTypes.number.isRequired,
};

export const Filter = {
  Bookmarks: 1,
  Likes: 2,
  Dislikes: 3,
};

export default ProfileFilterMenu;
