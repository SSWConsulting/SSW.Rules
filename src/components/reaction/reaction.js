/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';
import { useAuth } from 'oidc-react';
import {
  GetLikeDislikeForUser,
  PostReactionForUser,
  ReactionType,
} from '../../services/apiService';

const Reaction = (props) => {
  const { ruleId } = props;
  const { userData, signIn } = useAuth();
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDisikesCount] = useState(0);
  const [change, setChange] = useState(0);
  const [currentReactionType, setCurrentReactionType] = useState(null);

  useEffect(() => {
    if (userData) {
      GetLikeDislikeForUser(ruleId, userData.profile.sub)
        .then((success) => {
          setLikesCount(success.likeCount ?? 0);
          setDisikesCount(success.dislikeCount ?? 0);
          setCurrentReactionType(success.userStatus);
        })
        .catch((err) => {
          console.error('error', err);
        });
    } else {
      setCurrentReactionType(null);
      GetLikeDislikeForUser(ruleId)
        .then((success) => {
          setLikesCount(success.likeCount ?? 0);
          setDisikesCount(success.dislikeCount ?? 0);
        })
        .catch((err) => {
          console.error('error', err);
        });
    }
  }, [change, userData]);

  async function onClick(type) {
    if (userData) {
      const data = {
        type: type,
        ruleGuid: ruleId,
        userId: userData.profile.sub,
      };

      if (currentReactionType == null || currentReactionType != type) {
        const jwt = userData.access_token;
        if (type == ReactionType.Like) {
          if (currentReactionType != type && currentReactionType != null) {
            setDisikesCount(dislikesCount - 1);
          }
          setLikesCount(likesCount + 1);
        } else {
          if (currentReactionType != type && currentReactionType != null) {
            setLikesCount(likesCount - 1);
          }
          setDisikesCount(dislikesCount + 1);
        }
        setCurrentReactionType(type);
        PostReactionForUser(data, jwt)
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
        sessionStorage.setItem('returnUrl', currentPage);
        signIn();
      }
    }
  }

  return (
    <>
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
    </>
  );
};

Reaction.propTypes = {
  ruleId: PropTypes.string,
};

export default Reaction;
