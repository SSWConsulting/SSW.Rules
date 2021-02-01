/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';
import { useAuth } from 'oidc-react';
import {
  GetBookmarksForUser,
  BookmarkRule,
  RemoveBookmark,
} from '../../services/apiService';
import PropTypes from 'prop-types';

const Bookmark = (props) => {
  const { ruleId } = props;
  const [change, setChange] = useState(0);
  const { userData } = useAuth();
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (userData) {
      GetBookmarksForUser(userData.profile.sub, ruleId)
        .then((success) => {
          setBookmarked(success.bookmarkStatus);
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }, [userData, change]);

  function onClick() {
    if (userData) {
      !bookmarked
        ? BookmarkRule(
            { ruleGuid: ruleId, UserId: userData.profile.sub },
            userData.access_token
          )
            .then(() => {
              setChange(change + 1);
              setBookmarked(true);
            })
            .catch((err) => {
              console.error(err);
            })
        : RemoveBookmark(
            { ruleGuid: ruleId, UserId: userData.profile.sub },
            userData.access_token
          )
            .then(() => {
              setBookmarked(false);
              setChange(change + 1);
            })
            .catch((err) => {
              console.error(err);
            });
    }
  }

  return (
    <>
      {bookmarked ? (
        <div onClick={onClick} className="tooltip">
          <BookmarkIcon className="bookmark-icon-pressed" />
          <span className="tooltiptext">Remove bookmark</span>
        </div>
      ) : (
        <div onClick={onClick}>
          <BookmarkIcon className="bookmark-icon" />
        </div>
      )}
    </>
  );
};

Bookmark.propTypes = {
  ruleId: PropTypes.string,
};

export default Bookmark;
