/* eslint-disable no-console */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from 'react';
import PropTypes from 'prop-types';

const ProfileFilterMenu = ({
  selectedFilter,
  setSelectedFilter,
  superLikedRulesCount,
  likedRulesCount,
  dislikedRulesCount,
  superDislikedRulesCount,
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
            selectedFilter == Filter.SuperLikes
              ? {
                  gridColumn: 2,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 2 }
          }
          onClick={() => {
            setSelectedFilter(Filter.SuperLikes);
          }}
        >
          Super Likes
          <div className="rules-counter">{superLikedRulesCount ?? 0}</div>
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == Filter.Likes
              ? {
                  gridColumn: 3,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 3 }
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
                  gridColumn: 4,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 4 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Dislikes);
          }}
        >
          Dislikes
          <div className="rules-counter">{dislikedRulesCount ?? 0}</div>
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == Filter.SuperDislikes
              ? {
                  gridColumn: 5,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 5 }
          }
          onClick={() => {
            setSelectedFilter(Filter.SuperDislikes);
          }}
        >
          Super Dislikes
          <div className="rules-counter">{superDislikedRulesCount ?? 0}</div>
        </div>
      </div>
    </>
  );
};

ProfileFilterMenu.propTypes = {
  selectedFilter: PropTypes.number.isRequired,
  setSelectedFilter: PropTypes.func.isRequired,
  superLikedRulesCount: PropTypes.number.isRequired,
  likedRulesCount: PropTypes.number.isRequired,
  dislikedRulesCount: PropTypes.number.isRequired,
  superDislikedRulesCount: PropTypes.number.isRequired,
  bookmarkedRulesCount: PropTypes.number.isRequired,
};

export const Filter = {
  Bookmarks: 1,
  SuperLikes: 2,
  Likes: 3,
  Dislikes: 4,
  SuperDislikes: 5,
};

export default ProfileFilterMenu;
