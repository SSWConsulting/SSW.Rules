/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from 'react';
import PropTypes from 'prop-types';

const ProfileFilterMenu = ({ selectedFilter, setSelectedFilter }) => {
  return (
    <>
      <div className="filter-menu">
        <div
          className="menu-item"
          style={
            selectedFilter == 1
              ? { gridColumn: 1, borderBottom: '0.25rem solid #333333' }
              : { gridColumn: 1 }
          }
          onClick={() => {
            setSelectedFilter(1);
          }}
        >
          Bookmarks
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == 2
              ? { gridColumn: 2, borderBottom: '0.25rem solid #333333' }
              : { gridColumn: 2 }
          }
          onClick={() => {
            setSelectedFilter(2);
          }}
        >
          Likes
        </div>
        <div
          className="menu-item"
          style={
            selectedFilter == 3
              ? { gridColumn: 3, borderBottom: '0.25rem solid #333333' }
              : { gridColumn: 3 }
          }
          onClick={() => {
            setSelectedFilter(3);
          }}
        >
          Dislikes
        </div>
      </div>
    </>
  );
};
ProfileFilterMenu.propTypes = {
  selectedFilter: PropTypes.number.isRequired,
  setSelectedFilter: PropTypes.func.isRequired,
};

export default ProfileFilterMenu;
