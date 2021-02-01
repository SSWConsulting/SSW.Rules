import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { StaticQuery, graphql } from 'gatsby';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import ProfileBadge from '../components/profile-badge/profile-badge';
import ProfileContent from '../components/profile-content/profile-content';
import ProfileFilterMenu from '../components/profile-filter-menu/profile-filter-menu';
import GitHubIcon from '-!svg-react-loader!../images/github.svg';
import { useAuth } from 'oidc-react';

const Profile = ({ data }) => {
  const [selectedFilter, setSelectedFilter] = useState(1);
  const [listChange, setListChange] = useState(0);
  const { userData } = useAuth();
  const [bookmarkedRulesCount, setBookmarkedRulesCount] = useState();
  const [likedRulesCount, setLikedRulesCount] = useState();
  const [dislikedRulesCount, setDislikedRulesCount] = useState();

  useEffect(() => {}, [listChange, userData]);
  if (userData) {
    return (
      <>
        <Breadcrumb title="Profile" />
        <div className="rule-category rounded">
          <section className="mb-20 pb-2 rounded">
            <div className="profile-header rounded-t">
              <div className="grid-container">
                <div
                  style={{ gridRowStart: 1, gridRowEnd: 3 }}
                  className="profile-image"
                >
                  <ProfileBadge size="6.25rem" />
                </div>
                <div className="profile-large-name">
                  {userData ? userData.profile.given_name : ''}{' '}
                  {userData ? userData.profile.family_name : ''}
                </div>
                <div className="username">
                  @{userData ? userData.profile.name : ''}
                </div>
                <a
                  className="github-link"
                  href={`https://www.github.com/${userData.profile.name}`}
                >
                  <GitHubIcon style={{ margin: '0.15rem 0.2rem 0rem 0rem' }} />
                  Manage GitHub account
                </a>
              </div>
              <ProfileFilterMenu
                selectedFilter={selectedFilter}
                setSelectedFilter={setSelectedFilter}
                bookmarkedRulesCount={bookmarkedRulesCount}
                likedRulesCount={likedRulesCount}
                dislikedRulesCount={dislikedRulesCount}
                change={listChange}
              />
            </div>
            <div>
              <ProfileContent
                data={data}
                filter={selectedFilter}
                setListChangeCallback={setListChange}
                listChange={listChange}
                setBookmarkedRulesCount={setBookmarkedRulesCount}
                setLikedRulesCount={setLikedRulesCount}
                setDislikedRulesCount={setDislikedRulesCount}
              />
            </div>
          </section>
        </div>
      </>
    );
  } else {
    return (
      <>
        <p>Loading</p>
      </>
    );
  }
};
Profile.propTypes = {
  data: PropTypes.object.isRequired,
};

const ProfileWithQuery = (props) => (
  <StaticQuery
    query={graphql`
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
    `}
    render={(data) => <Profile data={data} {...props} />}
  />
);

export default ProfileWithQuery;
