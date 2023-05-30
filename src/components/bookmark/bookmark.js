/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import Tooltip from '../tooltip/tooltip';
import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';
import { useAuth0 } from '@auth0/auth0-react';
import {
  GetBookmarksForUser,
  BookmarkRule,
  RemoveBookmark,
} from '../../services/apiService';
import PropTypes from 'prop-types';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

const Bookmark = ({ ruleId, isSmall = false }) => {
  const [change, setChange] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);

  const { isAuthenticated, user, getIdTokenClaims, loginWithRedirect } =
    useAuth0();

  useEffect(() => {
    if (isAuthenticated) {
      GetBookmarksForUser(user.sub, ruleId)
        .then((success) => {
          setBookmarked(success.bookmarkStatus);
        })
        .catch((err) => {
          appInsights.trackException({
            error: new Error(err),
            severityLevel: 3,
          });
        });
    }
  }, [user, change]);

  async function onClick() {
    if (isAuthenticated) {
      setBookmarked(!bookmarked);
      const jwt = await getIdTokenClaims();
      const data = { ruleGuid: ruleId, UserId: user.sub };
      !bookmarked
        ? BookmarkRule(data, jwt.__raw)
            .then(() => {
              setChange(change + 1);
            })
            .catch((err) => {
              appInsights.trackException({
                error: new Error(err),
                severityLevel: 3,
              });
            })
        : RemoveBookmark({ ruleGuid: ruleId, UserId: user.sub }, jwt.__raw)
            .then(() => {
              setChange(change + 1);
            })
            .catch((err) => {
              appInsights.trackException({
                error: new Error(err),
                severityLevel: 3,
              });
            });
    } else {
      if (window.confirm('Sign in to bookmark this rule')) {
        const currentPage =
          typeof window !== 'undefined'
            ? window.location.pathname.split('/').pop()
            : null;
        await loginWithRedirect({
          appState: {
            targetUrl: currentPage,
          },
        });
      }
    }
  }

  return (
    <>
      {bookmarked ? (
        <Tooltip text="Remove Bookmark">
          <button onClick={onClick}>
            <BookmarkIcon
              className={` ${
                isSmall
                  ? 'w-4 hover:text-ssw-red hover:w-[18px]'
                  : 'bookmark-icon-pressed'
              }`}
            />
          </button>
        </Tooltip>
      ) : (
        <Tooltip text="Add Bookmark">
          <button onClick={onClick}>
            <BookmarkIcon
              className={` ${
                isSmall
                  ? 'w-4 hover:text-ssw-red hover:w-[18px]'
                  : 'bookmark-icon'
              }`}
            />
          </button>
        </Tooltip>
      )}
    </>
  );
};

Bookmark.propTypes = {
  ruleId: PropTypes.string,
  isSmall: PropTypes.bool,
};

export default Bookmark;
