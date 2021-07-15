/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth0 } from '@auth0/auth0-react';
import {
  GetReactionForUser,
  PostReactionForUser,
  ReactionType,
  RemoveReaction,
} from '../../services/apiService';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

const Reaction = (props) => {
  const { ruleId } = props;
  const [superLikesCount, setSuperLikesCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [superDislikesCount, setSuperDisikesCount] = useState(0);
  const [change, setChange] = useState(0);
  const [currentReactionType, setCurrentReactionType] = useState(null);

  const { isAuthenticated, user, getIdTokenClaims, loginWithRedirect } =
    useAuth0();

  useEffect(() => {
    if (isAuthenticated) {
      GetReactionForUser(ruleId, user.sub)
        .then((success) => {
          setSuperLikesCount(success.superLikeCount ?? 0);
          setLikesCount(success.likeCount ?? 0);
          setDislikesCount(success.dislikeCount ?? 0);
          setSuperDisikesCount(success.superDislikeCount ?? 0);
          setCurrentReactionType(success.userStatus);
        })
        .catch((err) => {
          appInsights.trackException({
            error: new Error(err),
            severityLevel: 3,
          });
        });
    } else {
      setCurrentReactionType(null);
      GetReactionForUser(ruleId)
        .then((success) => {
          setSuperLikesCount(success.superLikeCount ?? 0);
          setLikesCount(success.likeCount ?? 0);
          setDislikesCount(success.dislikeCount ?? 0);
          setSuperDisikesCount(success.superDislikeCount ?? 0);
        })
        .catch((err) => {
          appInsights.trackException({
            error: new Error(err),
            severityLevel: 3,
          });
        });
    }
  }, [change, user]);

  function removePreviousReaction() {
    if (currentReactionType == ReactionType.SuperLike) {
      setSuperLikesCount(superLikesCount - 1);
    } else if (currentReactionType == ReactionType.Like) {
      setLikesCount(likesCount - 1);
    } else if (currentReactionType == ReactionType.DisLike) {
      setDislikesCount(dislikesCount - 1);
    } else {
      setSuperDisikesCount(superDislikesCount - 1);
    }
  }

  async function onClick(type) {
    if (isAuthenticated) {
      const data = {
        type: type,
        ruleGuid: ruleId,
        userId: user.sub,
      };
      const jwt = await getIdTokenClaims();
      if (currentReactionType == type) {
        removePreviousReaction();
        setCurrentReactionType(null);
        RemoveReaction(data, jwt.__raw)
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
        if (type == ReactionType.SuperLike) {
          setSuperLikesCount(superLikesCount + 1);
        } else if (type == ReactionType.Like) {
          setLikesCount(likesCount + 1);
        } else if (type == ReactionType.DisLike) {
          setDislikesCount(dislikesCount + 1);
        } else if (type == ReactionType.SuperDisLike) {
          setSuperDisikesCount(superDislikesCount + 1);
        }
        if (currentReactionType != null && currentReactionType != type) {
          removePreviousReaction();
        }
        setCurrentReactionType(type);
        PostReactionForUser(data, jwt.__raw)
          .then(() => {
            setChange(change + 1);
          })
          .catch((err) => {
            appInsights.trackException({
              error: new Error(err),
              severityLevel: 3,
            });
          });
      }
    } else {
      if (window.confirm('Sign in to rate this rule')) {
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
    <div className="reaction-grid">
      <div className="agree-grid-item">
        <div className="react-tooltip">
          <button
            className={
              currentReactionType == ReactionType.SuperLike
                ? 'agree-btn-container-pressed'
                : 'agree-btn-container'
            }
            onClick={() => onClick(ReactionType.SuperLike)}
          />
          <span className="tooltiptext">
            {currentReactionType == ReactionType.SuperLike
              ? 'Remove rating'
              : 'Love it'}
          </span>
        </div>
      </div>
      <div className="reaction-counter-container">{superLikesCount}</div>
      <div className="somewhat-agree-grid-item">
        <div className="react-tooltip">
          <button
            onClick={() => onClick(ReactionType.Like)}
            className={
              currentReactionType == ReactionType.Like
                ? 'somewhat-agree-btn-container-pressed'
                : 'somewhat-agree-btn-container'
            }
          />
          <span className="tooltiptext">
            {currentReactionType == ReactionType.Like
              ? 'Remove rating'
              : 'Agree'}
          </span>
        </div>
      </div>
      <div className="reaction-counter-container">{likesCount}</div>
      <div className="somewhat-disagree-grid-item">
        <div className="react-tooltip">
          <button
            className={
              currentReactionType == ReactionType.DisLike
                ? 'somewhat-disagree-btn-container-pressed'
                : 'somewhat-disagree-btn-container'
            }
            onClick={() => onClick(ReactionType.DisLike)}
          />
          <span className="tooltiptext">
            {currentReactionType == ReactionType.DisLike
              ? 'Remove rating'
              : 'Disagree'}
          </span>
        </div>
      </div>
      <div className="reaction-counter-container">{dislikesCount}</div>
      <div className="disagree-grid-item">
        <div className="react-tooltip">
          <button
            className={
              currentReactionType == ReactionType.SuperDisLike
                ? 'disagree-btn-container-pressed'
                : 'disagree-btn-container'
            }
            onClick={() => onClick(ReactionType.SuperDisLike)}
          />
          <span className="tooltiptext">
            {currentReactionType == ReactionType.SuperDisLike
              ? 'Remove rating'
              : 'No way'}
          </span>
        </div>
      </div>
      <div className="reaction-counter-container">{superDislikesCount}</div>
    </div>
  );
};

Reaction.propTypes = {
  ruleId: PropTypes.string,
};

export default Reaction;
