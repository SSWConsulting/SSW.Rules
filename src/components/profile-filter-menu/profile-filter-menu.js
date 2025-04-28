import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';
import PropTypes from 'prop-types';
import React from 'react';

const ProfileFilterMenu = ({
  selectedFilter,
  setSelectedFilter,
  bookmarkedRulesCount,
}) => {
  return (
    <>
      <div className="filter-menu">
        <button
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
        </button>
      </div>
    </>
  );
};

ProfileFilterMenu.propTypes = {
  selectedFilter: PropTypes.number.isRequired,
  setSelectedFilter: PropTypes.func.isRequired,
  bookmarkedRulesCount: PropTypes.number,
};

export const Filter = {
  Bookmarks: 0,
};
export default ProfileFilterMenu;
