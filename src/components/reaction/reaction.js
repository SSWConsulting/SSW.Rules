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
import { useAuthService } from '../../services/authService';
import useAppInsights from '../../hooks/useAppInsights';

const Reaction = (props) => {
  const { ruleId } = props;
  const [superLikesCount, setSuperLikesCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [superDislikesCount, setSuperDisikesCount] = useState(0);
  const [change, setChange] = useState(0);
  const [currentReactionType, setCurrentReactionType] = useState(null);

  const { isAuthenticated, user, loginWithRedirect } = useAuth0();
  const { fetchIdToken } = useAuthService();

  const { trackException } = useAppInsights();

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
          trackException(err, 3);
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
          trackException(err, 3);
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
      const idToken = await fetchIdToken();
      if (currentReactionType == type) {
        removePreviousReaction();
        setCurrentReactionType(null);
        RemoveReaction(data, idToken)
          .then(() => {
            setChange(change + 1);
          })
          .catch((err) => {
            trackException(err, 3);
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
        PostReactionForUser(data, idToken)
          .then(() => {
            setChange(change + 1);
          })
          .catch((err) => {
            trackException(err, 3);
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
      <div className="relative top-3 text-sm text-start pl-2">
        {superLikesCount}
      </div>
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
      <div className="relative top-3 text-sm text-start pl-2">{likesCount}</div>
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
      <div className="relative top-3 text-sm text-start pl-2">
        {dislikesCount}
      </div>
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
      <div className="relative top-3 text-sm text-start pl-2">
        {superDislikesCount}
      </div>
    </div>
  );
};

Reaction.propTypes = {
  ruleId: PropTypes.string,
};

export default Reaction;
