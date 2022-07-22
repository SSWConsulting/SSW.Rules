/* eslint-disable no-console */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from 'react';
import PropTypes from 'prop-types';
import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';
import DisqusIcon from '-!svg-react-loader!../../images/disqusIcon.svg';

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
          className="menu-item"
          style={
            selectedFilter == Filter.Bookmarks
              ? {
                  gridColumn: 1,
                  borderBottom: '0.25rem solid #cc4141',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 1 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Bookmarks);
          }}
        >
          Bookmarks
          <BookmarkIcon
            className={
              selectedFilter != Filter.Bookmarks
                ? 'filter-menu-bookmark-icon'
                : 'filter-menu-bookmark-icon-pressed'
            }
          />
          <div className="mx-1">{bookmarkedRulesCount ?? 0}</div>
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == Filter.Comments
              ? {
                  gridColumn: 2,
                  borderBottom: '0.25rem solid #cc4141',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 2 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Comments);
          }}
        >
          Comments
          <DisqusIcon
            className={
              selectedFilter != Filter.Comments
                ? 'filter-menu-disqus-icon'
                : 'filter-menu-disqus-icon-pressed'
            }
          />
          <div className="mx-2">{commentedRulesCount ?? 0}</div>
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == Filter.SuperLikes
              ? {
                  gridColumn: 3,
                  borderBottom: '0.25rem solid #cc4141',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 3 }
          }
          onClick={() => {
            setSelectedFilter(Filter.SuperLikes);
          }}
        >
          <div
            className={
              selectedFilter != Filter.SuperLikes
                ? 'love-title'
                : 'love-title-pressed'
            }
          >
            Love it
          </div>
          <div className="mx-1">{superLikedRulesCount ?? 0}</div>
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == Filter.Likes
              ? {
                  gridColumn: 4,
                  borderBottom: '0.25rem solid #cc4141',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 4 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Likes);
          }}
        >
          <div
            className={
              selectedFilter != Filter.Likes
                ? 'agree-title'
                : 'agree-title-pressed'
            }
          >
            Agree
          </div>
          <div className="mx-1">{likedRulesCount ?? 0}</div>
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == Filter.Dislikes
              ? {
                  gridColumn: 5,
                  borderBottom: '0.25rem solid #cc4141',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 5 }
          }
          onClick={() => {
            setSelectedFilter(Filter.Dislikes);
          }}
        >
          <div
            className={
              selectedFilter != Filter.Dislikes
                ? 'disagree-title'
                : 'disagree-title-pressed'
            }
          >
            Disagree
          </div>
          <div className="mx-1">{dislikedRulesCount ?? 0}</div>
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == Filter.SuperDislikes
              ? {
                  gridColumn: 6,
                  borderBottom: '0.25rem solid #cc4141',
                  paddingBottom: '0.25rem',
                }
              : { gridColumn: 6 }
          }
          onClick={() => {
            setSelectedFilter(Filter.SuperDislikes);
          }}
        >
          <div
            className={
              selectedFilter != Filter.SuperDislikes
                ? 'super-disagree-title'
                : 'super-disagree-title-pressed'
            }
          >
            No way
          </div>
          <div className="mx-1">{superDislikedRulesCount ?? 0}</div>
        </div>
      </div>
    </>
  );
};

ProfileFilterMenu.propTypes = {
  selectedFilter: PropTypes.number.isRequired,
  setSelectedFilter: PropTypes.func.isRequired,
  superLikedRulesCount: PropTypes.number,
  likedRulesCount: PropTypes.number,
  dislikedRulesCount: PropTypes.number,
  superDislikedRulesCount: PropTypes.number,
  bookmarkedRulesCount: PropTypes.number,
  commentedRulesCount: PropTypes.number,
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
