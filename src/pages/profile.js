/* eslint-disable no-console */
import DisqusIcon from '-!svg-react-loader!../images/disqusIcon.svg';
import GitHubIcon from '-!svg-react-loader!../images/github.svg';
import { useAuth0 } from '@auth0/auth0-react';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { graphql, useStaticQuery } from 'gatsby';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import ProfileBadge from '../components/profile-badge/profile-badge';
import ProfileContent from '../components/profile-content/profile-content';
import ProfileFilterMenu from '../components/profile-filter-menu/profile-filter-menu';
import { GetUser } from '../services/apiService';
import { useAuthService } from '../services/authService';

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

const Profile = ({ data, gitHubUsername }) => {
  const [selectedFilter, setSelectedFilter] = useState(4);
  const [state, setState] = useState(0);
  const { user, isAuthenticated, loginWithRedirect } = useAuth0();
  const { fetchIdToken } = useAuthService();
  const [commentsConnected, setCommentsConnected] = useState(false);
  const [bookmarkedRulesCount, setBookmarkedRulesCount] = useState();
  const [superLikedRulesCount, setSuperLikedRulesCount] = useState();
  const [likedRulesCount, setLikedRulesCount] = useState();
  const [dislikedRulesCount, setDislikedRulesCount] = useState();
  const [superDislikedRulesCount, setSuperDislikedRulesCount] = useState();
  const [commentedRulesCount, setCommentedRulesCount] = useState();

  async function CheckUser() {
    const jwt = await fetchIdToken();
    GetUser(user.sub, jwt)
      .then((success) => {
        setCommentsConnected(success.commentsConnected);
      })
      .catch((err) => {
        appInsights.trackException({
          error: new Error(err),
          severityLevel: 3,
        });
      });
  }

  useEffect(() => {
    if (isAuthenticated) {
      CheckUser();
    }
  }, [state, user]);
  if (isAuthenticated) {
    return (
      <>
        <Breadcrumb title="Profile" />
        <div className="rule-category rounded">
          <section className="mb-20 pb-2 rounded">
            <div className="profile-header rounded-t">
              <div className="grid-container">
                <div className="profile-image">
                  <ProfileBadge size="6.25rem" />
                </div>
                <div className="profile-large-name">
                  {isAuthenticated ? user.name : ''}
                </div>
                <a
                  className="github-link"
                  href={`https://www.github.com/${user.nickname}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <GitHubIcon className="profile-github-icon" />
                  GitHub account
                </a>
                {commentsConnected ? (
                  <a
                    className="disqus-link"
                    target="_blank"
                    rel="noreferrer"
                    href="https://disqus.com/home"
                  >
                    <DisqusIcon className="profile-disqus-icon" />
                    Disqus account
                  </a>
                ) : null}
              </div>
              <ProfileFilterMenu
                selectedFilter={selectedFilter}
                setSelectedFilter={setSelectedFilter}
                bookmarkedRulesCount={bookmarkedRulesCount}
                superLikedRulesCount={superLikedRulesCount}
                likedRulesCount={likedRulesCount}
                dislikedRulesCount={dislikedRulesCount}
                superDislikedRulesCount={superDislikedRulesCount}
                commentedRulesCount={commentedRulesCount}
                change={state}
              />
            </div>
            <div>
              <ProfileContent
                data={data}
                filter={selectedFilter}
                setState={setState}
                state={state}
                setBookmarkedRulesCount={setBookmarkedRulesCount}
                setSuperLikedRulesCount={setSuperLikedRulesCount}
                setLikedRulesCount={setLikedRulesCount}
                setDislikedRulesCount={setDislikedRulesCount}
                setSuperDislikedRulesCount={setSuperDislikedRulesCount}
                setCommentedRulesCount={setCommentedRulesCount}
              />
            </div>
          </section>
        </div>
      </>
    );
  } else {
    return (
      <div className="no-content-message">
        <button
          onClick={async () => {
            const currentPage =
              typeof window !== 'undefined'
                ? window.location.pathname.split('/').pop()
                : null;
            await loginWithRedirect({
              appState: {
                targetUrl: currentPage,
              },
            });
          }}
        >
          Login to view profile
        </button>
        <div>{gitHubUsername}</div>
      </div>
    );
  }
};
Profile.propTypes = {
  data: PropTypes.object.isRequired,
  gitHubUsername: PropTypes.string,
};

function ProfileWithQuery(props) {
  const data = useStaticQuery(graphql`
    query ProfilePageQuery {
      allMdx(filter: { frontmatter: { type: { eq: "rule" } } }) {
        nodes {
          frontmatter {
            title
            uri
            guid
            authors {
              title
            }
          }
        }
      }
    }
  `);

  return <Profile data={data} {...props} />;
}

ProfilePage.propTypes = {
  gitHubUsername: PropTypes.string,
  props: PropTypes.any,
};

export default function ProfilePage({ gitHubUsername, props }) {
  return (
    <>
      <ProfileWithQuery gitHubUsername={gitHubUsername} {...props} />
    </>
  );
}
