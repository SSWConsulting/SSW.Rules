/* eslint-disable no-console */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from 'react';
import PropTypes from 'prop-types';

const ProfileFilterMenu = ({
  selectedFilter,
  setSelectedFilter,
  likedRulesCount,
  dislikedRulesCount,
  bookmarkedRulesCount,
}) => {
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
          <div className="rules-counter">{bookmarkedRulesCount ?? 0}</div>
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
          <div className="rules-counter">{likedRulesCount ?? 0}</div>
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
            className="rules-counter"
            style={{
              color: '#cc4141',
            }}
          >
            {dislikedRulesCount ?? 0}
          </div>
        </div>
      </div>
    </>
  );
};

ProfileFilterMenu.propTypes = {
  selectedFilter: PropTypes.number.isRequired,
  setSelectedFilter: PropTypes.func.isRequired,
  likedRulesCount: PropTypes.number.isRequired,
  dislikedRulesCount: PropTypes.number.isRequired,
  bookmarkedRulesCount: PropTypes.number.isRequired,
};

export const Filter = {
  Bookmarks: 1,
  Likes: 2,
  Dislikes: 3,
};

export default ProfileFilterMenu;
