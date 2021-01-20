/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import BookmarkIcon from '-!svg-react-loader!../../images/BookmarkIcon.svg';
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
          ).then(() => {
            setChange(change + 1);
            setBookmarked(true);
          })
        : RemoveBookmark(
            { ruleGuid: ruleId, UserId: userData.profile.sub },
            userData.access_token
          ).then(() => {
            setBookmarked(false);
            setChange(change + 1);
          });
    }
  }

  return (
    <>
      <button onClick={onClick}>
        <BookmarkIcon
          style={bookmarked ? { color: 'cc4141' } : { color: 'ccc' }}
          className="bookmark-icon"
        />
      </button>
    </>
  );
};

Bookmark.propTypes = {
  ruleId: PropTypes.string,
};

export default Bookmark;
