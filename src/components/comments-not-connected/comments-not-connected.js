import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
  GetDisqusUser,
  ConnectUserCommentsAccount,
  DisqusError,
} from '../../services/apiService';
import DisqusIcon from '-!svg-react-loader!../../images/disqusIcon.svg';

import { useAuth0 } from '@auth0/auth0-react';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

const CommentsNotConnected = ({ userCommentsConnected, setState, state }) => {
  const [disqusUsername, setDisqusUsername] = useState();
  const [errorMessage, setErrorMessage] = useState(null);

  const { user, getIdTokenClaims } = useAuth0();

  function connectAccounts() {
    if (disqusUsername) {
      GetDisqusUser(disqusUsername)
        .then(async (success) => {
          if (success.code == DisqusError.InvalidArg) {
            setErrorMessage('Username does not exist');
          }
          const jwt = await getIdTokenClaims();
          ConnectUserCommentsAccount(
            {
              UserId: user.sub,
              CommentsUserId: success.response.id,
            },
            jwt.__raw
          )
            .then((response) => {
              setState(state + 1);
              if (response.code == 409) {
                setErrorMessage(
                  'Another user is already using this comments account'
                );
              }
            })
            .catch((err) => {
              appInsights.trackException({
                error: new Error(err),
                severityLevel: 3,
              });
            });
        })
        .catch((err) => {
          appInsights.trackException({
            error: new Error(err),
            severityLevel: 3,
          });
        });
    }
  }

  useEffect(() => {}, [userCommentsConnected, state]);
  return (
    <div className="connect-acc-container">
      <DisqusIcon className="disqus-large-icon" />
      <div className="form">
        <div>
          <input
            className={
              !errorMessage ? 'username-input-box' : 'username-input-box-error'
            }
            type="text"
            name="disqusId"
            value={disqusUsername}
            placeholder="Enter Disqus Username"
            onChange={(e) => setDisqusUsername(e.target.value)}
          />
          <div className="forgot-username-tooltip">
            {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
            <a
              href="https://disqus.com/home/"
              target="_blank"
              rel="noreferrer"
              className="get-username-btn unstyled"
            />
            <span className="tooltiptext">Forgot username? </span>
          </div>
          <p className="error-text">{errorMessage}</p>
        </div>

        <button className="connect-acc-button" onClick={connectAccounts}>
          Connect Account
        </button>
      </div>
    </div>
  );
};

CommentsNotConnected.propTypes = {
  userCommentsConnected: PropTypes.bool,
  setState: PropTypes.func,
  state: PropTypes.number,
};

export default CommentsNotConnected;
