/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth0 } from '@auth0/auth0-react';
import {
  GetReactionForUser,
  PostReactionForUser,
  ReactionType,
} from '../../services/apiService';

const Reaction = (props) => {
  const { ruleId } = props;
  const [superLikesCount, setSuperLikesCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [superDislikesCount, setSuperDisikesCount] = useState(0);
  const [change, setChange] = useState(0);
  const [currentReactionType, setCurrentReactionType] = useState(null);

  const {
    isAuthenticated,
    user,
    getIdTokenClaims,
    loginWithRedirect,
  } = useAuth0();

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
          console.error('error', err);
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
          console.error('error', err);
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

      if (currentReactionType == null || currentReactionType != type) {
        const jwt = await getIdTokenClaims();
        if (type == ReactionType.SuperLike) {
          setSuperLikesCount(superLikesCount + 1);
        } else if (type == ReactionType.Like) {
          setLikesCount(likesCount + 1);
        } else if (type == ReactionType.DisLike) {
          setDislikesCount(dislikesCount + 1);
        } else if (type == ReactionType.SuperDisLike) {
          setSuperDisikesCount(superDislikesCount + 1);
        }
        if (currentReactionType != type && currentReactionType != null) {
          removePreviousReaction();
        }
        setCurrentReactionType(type);
        PostReactionForUser(data, jwt.__raw)
          .then(() => {
            setChange(change + 1);
          })
          .catch((err) => {
            console.error('error', err);
          });
      }
    } else {
      if (
        window.confirm(
          `Sign in to ${
            type == ReactionType.Like ? 'like' : 'dislike'
          } this rule`
        )
      ) {
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
      <span>
        <button
          className={
            currentReactionType == ReactionType.SuperLike
              ? 'super-like-btn-container-pressed'
              : 'super-like-btn-container'
          }
          onClick={() => onClick(ReactionType.SuperLike)}
        ></button>
        <div className="likes-counter-container">{superLikesCount}</div>
      </span>
      <span>
        <button
          onClick={() => onClick(ReactionType.Like)}
          className={
            currentReactionType == ReactionType.Like
              ? 'likes-btn-container-pressed'
              : 'likes-btn-container'
          }
        ></button>
        <div className="likes-counter-container">{likesCount}</div>
      </span>
      <span>
        <button
          className={
            currentReactionType == ReactionType.DisLike
              ? 'dislikes-btn-container-pressed'
              : 'dislikes-btn-container'
          }
          onClick={() => onClick(ReactionType.DisLike)}
        ></button>
        <div className="likes-counter-container">{dislikesCount}</div>
      </span>
      <span>
        <button
          className={
            currentReactionType == ReactionType.SuperDisLike
              ? 'super-dislike-btn-container-pressed'
              : 'super-dislike-btn-container'
          }
          onClick={() => onClick(ReactionType.SuperDisLike)}
        ></button>
        <div className="likes-counter-container">{superDislikesCount}</div>
      </span>
    </>
  );
};

Reaction.propTypes = {
  ruleId: PropTypes.string,
};

export default Reaction;
