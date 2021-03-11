/* eslint-disable no-console */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from 'react';
import PropTypes from 'prop-types';
import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';

const ProfileFilterMenu = ({
  selectedFilter,
  setSelectedFilter,
  superLikedRulesCount,
  likedRulesCount,
  dislikedRulesCount,
  superDislikedRulesCount,
  bookmarkedRulesCount,
  commentedRulesCount,
}) => {
  return (
    <>
      <div className="filter-menu">
        <div
          className="bookmarks-item"
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
          <BookmarkIcon className="filter-menu-bookmark-icon" />
          Bookmarks
          <div className="rules-counter">{bookmarkedRulesCount ?? 0}</div>
        </div>
        <div
          className="comments-item"
          style={
            selectedFilter == Filter.Comments
              ? {
                  gridColumn: 2,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 2 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Comments);
          }}
        >
          Comments
          <div className="rules-counter">{commentedRulesCount ?? 0}</div>
        </div>
        <div
          className="really-agree-item"
          style={
            selectedFilter == Filter.SuperLikes
              ? {
                  gridColumn: 3,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 3 }
          }
          onClick={() => {
            setSelectedFilter(Filter.SuperLikes);
          }}
        >
          Love it!
          <div className="rules-counter">{superLikedRulesCount ?? 0}</div>
        </div>
        <div
          className="somewhat-agree-item"
          style={
            selectedFilter == Filter.Likes
              ? {
                  gridColumn: 4,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 4 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Likes);
          }}
        >
          Agree
          <div className="rules-counter">{likedRulesCount ?? 0}</div>
        </div>
        <div
          className="somewhat-disagree-item"
          style={
            selectedFilter == Filter.Dislikes
              ? {
                  gridColumn: 5,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 5 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Dislikes);
          }}
        >
          Disagree
          <div className="rules-counter">{dislikedRulesCount ?? 0}</div>
        </div>
        <div
          className="really-disagree-item"
          style={
            selectedFilter == Filter.SuperDislikes
              ? {
                  gridColumn: 6,
                  borderBottom: '0.25rem solid #333333',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 6 }
          }
          onClick={() => {
            setSelectedFilter(Filter.SuperDislikes);
          }}
        >
          No way!
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
  commentedRulesCount: PropTypes.number.isRequired,
};

export const Filter = {
  Comments: 5,
  Bookmarks: 4,
  SuperLikes: 3,
  Likes: 2,
  Dislikes: 1,
  SuperDislikes: 0,
};
export default ProfileFilterMenu;
