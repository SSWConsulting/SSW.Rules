import React, { useState } from 'react';

const SignIn = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  function githubAuth() {
    setIsLoggedIn(true);
    throw 'GitHub Authentication has not yet been implemented';
  }

  return (
    <div>
      {isLoggedIn ? (
        <div>
          <div>
            Welcome Username
            <button
              className="btn btn-red"
              onClick={() => setIsLoggedIn(false)}
            >
              Log Out
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-red" onClick={() => githubAuth()}>
          Login
        </button>
      )}
    </div>
  );
};

export default SignIn;
