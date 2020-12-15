import React, { useState } from 'react';
import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const Reaction = () => {
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDisikesCount] = useState(0);
  const [currentReactionType, setCurrentReactionType] = useState(null);
  var isLoggedIn = true;

  function addReaction(newReactionType) {
    if (isLoggedIn) {
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
      <h5>Feedback</h5>
      {/* <span>
        <div className="likes-counter-container">{likesCount}</div>
        <FontAwesomeIcon
          icon={faThumbsUp}
          color={currentReactionType ? 'green' : null}
          className="good"
          onClick={isLoggedIn ? () => addReaction(true) : null}
        />
      </span>
      <span>
        <FontAwesomeIcon
          icon={faThumbsDown}
          color={currentReactionType == false ? 'red' : null}
          className="bad"
          onClick={isLoggedIn ? () => addReaction(false) : null}
        />
        <div className="likes-counter-container">{dislikesCount}</div>
      </span> */}
      <div>
        <small className="suggestion">
          <a href="https://github.com/SSWConsulting/SSW.Rules.Content/issues">
            Make a suggestion
          </a>
        </small>
      </div>
    </>
  );
};

export default Reaction;
