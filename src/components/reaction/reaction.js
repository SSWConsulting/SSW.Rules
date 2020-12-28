import React, { useState } from 'react';
import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth0 } from '@auth0/auth0-react';

const Reaction = () => {
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDisikesCount] = useState(0);
  const [currentReactionType, setCurrentReactionType] = useState(null);
  const { isAuthenticated } = useAuth0();

  function addReaction(newReactionType) {
    if (isAuthenticated) {
      if (currentReactionType == null) {
        if (newReactionType) {
          setLikesCount(likesCount + 1);
        } else {
          setDisikesCount(dislikesCount + 1);
        }
        setCurrentReactionType(newReactionType);
      } else {
        if (newReactionType != currentReactionType) {
          if (newReactionType) {
            setDisikesCount(dislikesCount - 1);
            setLikesCount(likesCount + 1);
          } else {
            setLikesCount(likesCount - 1);
            setDisikesCount(dislikesCount + 1);
          }
          setCurrentReactionType(newReactionType);
        }
      }
    }
  }

  return (
    <>
      <span>
        <div className="likes-counter-container">{likesCount}</div>
        <FontAwesomeIcon
          icon={faThumbsUp}
          color={currentReactionType ? 'green' : null}
          className="good"
          onClick={isAuthenticated ? () => addReaction(true) : null}
        />
        <div className="likes-counter-container">{likesCount}</div>
      </span>
      <span>
        <FontAwesomeIcon
          icon={faThumbsDown}
          color={currentReactionType == false ? 'red' : null}
          className="bad"
          onClick={isAuthenticated ? () => addReaction(false) : null}
        />
        <div className="likes-counter-container">{dislikesCount}</div>
      </span>
    </>
  );
};

export default Reaction;
