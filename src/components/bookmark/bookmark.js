/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';
import { useAuth0 } from '@auth0/auth0-react';
import {
  GetBookmarksForUser,
  BookmarkRule,
  RemoveBookmark,
} from '../../services/apiService';
import PropTypes from 'prop-types';

const Bookmark = (props) => {
  const { ruleId } = props;
  const [change, setChange] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);

  const { isAuthenticated, user, getIdTokenClaims } = useAuth0();

  useEffect(() => {
    if (isAuthenticated) {
      GetBookmarksForUser(user.sub, ruleId)
        .then((success) => {
          setBookmarked(success.bookmarkStatus);
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }, [user, change]);

  async function onClick() {
    if (isAuthenticated) {
      const jwt = await getIdTokenClaims();
      !bookmarked
        ? BookmarkRule({ ruleGuid: ruleId, UserId: user.sub }, jwt.__raw)
            .then(() => {
              setChange(change + 1);
              setBookmarked(true);
            })
            .catch((err) => {
              console.error(err);
            })
        : RemoveBookmark({ ruleGuid: ruleId, UserId: user.sub }, jwt.__raw)
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
