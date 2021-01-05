/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth0 } from '@auth0/auth0-react';
import PropTypes from 'prop-types';
import {
  GetLikeDislikeForUser,
  PostReactionForUser,
  ReactionType,
} from '../../services/apiService';

const Reaction = (props) => {
  const { ruleId } = props;

  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDisikesCount] = useState(0);
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
      GetLikeDislikeForUser(ruleId, user.sub)
        .then((success) => {
          setLikesCount(success.likeCount ?? 0);
          setDisikesCount(success.dislikeCount ?? 0);
          setCurrentReactionType(success.userStatus);
        })
        .catch((err) => {
          console.error('error', err);
        });
    } else {
      GetLikeDislikeForUser(ruleId)
        .then((success) => {
          setLikesCount(success.likeCount ?? 0);
          setDisikesCount(success.dislikeCount ?? 0);
        })
        .catch((err) => {
          console.error('error', err);
        });
    }
  }, [change]);

  async function onClick(type) {
    if (isAuthenticated) {
      const data = {
        type: type,
        ruleGuid: ruleId,
        userId: user.sub,
      };

      if (currentReactionType == null || currentReactionType != type) {
        const jwt = await getIdTokenClaims();
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
        PostReactionForUser(data, jwt.__raw)
          .then(() => {
            setChange(change + 1);
          })
          .catch((err) => {
            console.error('error', err);
          });
      }
    } else {
      if (window.confirm('Sign in to react')) {
        await loginWithRedirect();
      }
    }
  }

  return (
    <>
      <span>
        <FontAwesomeIcon
          icon={faThumbsUp}
          color={currentReactionType == ReactionType.Like ? 'green' : null}
          className="good"
          onClick={() => onClick(ReactionType.Like)}
        />
        <div className="likes-counter-container">{likesCount}</div>
      </span>
      <span>
        <FontAwesomeIcon
          icon={faThumbsDown}
          color={currentReactionType == ReactionType.DisLike ? 'red' : null}
          className="bad"
          onClick={() => onClick(ReactionType.DisLike)}
        />
        <div className="likes-counter-container">{dislikesCount}</div>
      </span>
    </>
  );
};

Reaction.propTypes = {
  ruleId: PropTypes.string,
};

export default Reaction;
