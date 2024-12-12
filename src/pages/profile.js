import GitHubIcon from '-!svg-react-loader!../images/github.svg';
import { useAuth0 } from '@auth0/auth0-react';
import { graphql, useStaticQuery } from 'gatsby';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import ProfileBadge from '../components/profile-badge/profile-badge';
import ProfileContent from '../components/profile-content/profile-content';
import ProfileFilterMenu from '../components/profile-filter-menu/profile-filter-menu';

const Profile = ({ data }) => {
  const [selectedFilter, setSelectedFilter] = useState(0);
  const [state, setState] = useState(0);
  const [bookmarkedRulesCount, setBookmarkedRulesCount] = useState();
  const { user, isAuthenticated } = useAuth0();

  if (isAuthenticated) {
    return (
      <>
        <Breadcrumb breadcrumbText="Profile" />
        <div className="rule-category rounded">
          <section className="mb-20 pb-2 rounded">
            <div className="profile-header rounded-t">
              <div className="grid-container profile-container-responsive">
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
              </div>
              <ProfileFilterMenu
                selectedFilter={selectedFilter}
                setSelectedFilter={setSelectedFilter}
                bookmarkedRulesCount={bookmarkedRulesCount}
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
              />
            </div>
          </section>
        </div>
      </>
    );
  } else {
    return (
      <p className="text-xl no-content-message">
        Please first login to view profile
      </p>
    );
  }
};
Profile.propTypes = {
  data: PropTypes.object.isRequired,
};

function ProfileWithQuery(props) {
  const data = useStaticQuery(graphql`
    query ProfilePageQuery {
      allMarkdownRemark(filter: { frontmatter: { type: { eq: "rule" } } }) {
        nodes {
          excerpt(format: HTML, pruneLength: 500)
          frontmatter {
            title
            uri
            guid
            authors {
              title
            }
          }
          htmlAst
        }
      }
    }
  `);

  return <Profile data={data} {...props} />;
}

ProfilePage.propTypes = {
  props: PropTypes.any,
};

export default function ProfilePage({ props }) {
  return (
    <>
      <ProfileWithQuery {...props} />
    </>
  );
}
