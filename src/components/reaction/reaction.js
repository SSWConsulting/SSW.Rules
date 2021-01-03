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
  const ruleId = props.ruleId; // <- extracts fields from props

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
    //Runs on load, and when the stuff in the array changes
    console.log('running get likes/dislikes');
    if (isAuthenticated) {
      GetLikeDislikeForUser(ruleId, user.sub)
        .then((success) => {
          console.log(success);
          setLikesCount(success.likeCount ?? 0);
          setDisikesCount(success.dislikeCount ?? 0);
          setCurrentReactionType(success.userStatus);
        })
        .catch((err) => {
          console.log('error', err);
        });
    } else {
      GetLikeDislikeForUser(ruleId)
        .then((success) => {
          console.log(success);
          setLikesCount(success.likeCount);
          setDisikesCount(success.dislikeCount);
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
        console.log(jwt.__raw);
        if (type == ReactionType.Like) {
          if (currentReactionType != type) {
            setDisikesCount(dislikesCount - 1);
          }
          setLikesCount(likesCount + 1);
        } else {
          if (currentReactionType != type) {
            setLikesCount(likesCount - 1);
          }
          setDisikesCount(dislikesCount + 1);
        }
        setCurrentReactionType(type);
        PostReactionForUser(data, jwt.__raw)
          .then((success) => {
            console.log(success);
            setChange(change + 1);
          })
          .catch((err) => {
            console.error('error', err);
          });
      }
    } else {
      if (window.confirm('Sign in to react')) {
        await loginWithRedirect();
        // 1. redirect uri
        // 2. Add reaction
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
  ruleId: PropTypes.number,
};

export default Reaction;
