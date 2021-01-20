/* eslint-disable no-console */
import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'gatsby';
import {
  GetBookmarksForUser,
  GetAllLikedDisliked,
  RemoveBookmark,
  RemoveLikeDislike,
} from '../../services/apiService';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from 'oidc-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const ProfileContent = ({ data, filter }) => {
  const [bookmarkedRules, setBookmarkedRules] = useState();
  const [likedRules, setLikedRules] = useState();
  const [dislikedRules, setDislikedRules] = useState();
  const [change, setChange] = useState(0);
  const [viewStyle, setViewStyle] = useState('titleOnly');
  const { userData } = useAuth();

  const handleOptionChange = (e) => {
    setViewStyle(e.target.value);
  };

  function onRemoveClick(ruleGuid) {
    if (userData) {
      filter == 1
        ? RemoveBookmark(
            { ruleGuid: ruleGuid, UserId: userData.profile.sub },
            userData.access_token
          )
            .then(() => {
              setChange(change + 1);
            })
            .catch((err) => {
              console.error('error: ' + err);
            })
        : RemoveLikeDislike(
            { ruleGuid: ruleGuid, UserId: userData.profile.sub },
            userData.access_token
          )
            .then(() => {
              setChange(change + 1);
            })
            .catch((err) => {
              console.error('error: ' + err);
            });
    }
  }

  function getBookmarkList() {
    GetBookmarksForUser(userData.profile.sub)
      .then((success) => {
        const allRules = data.allMarkdownRemark.nodes;
        const bookmarkedGuids =
          success.bookmarkedRules.size != 0
            ? success.bookmarkedRules.map((r) => r.ruleGuid)
            : null;
        const bookmarkedRulesMap = allRules.filter((value) =>
          bookmarkedGuids.includes(value.frontmatter.guid)
        );
        const bookmarkedRulesSpread = bookmarkedRulesMap.map((r) => ({
          ...r.frontmatter,
          excerpt: r.excerpt,
        }));
        setBookmarkedRules(bookmarkedRulesSpread);
      })
      .catch((err) => {
        console.error('error: ', err);
      });
  }

  function getLikesDislikesLists() {
    GetAllLikedDisliked(userData.profile.sub)
      .then((success) => {
        const allRules = data.allMarkdownRemark.nodes;
        const likedGuids = success.likesDislikedRules.map((r) => r.ruleGuid);
        const reactedRules = allRules.filter((value) =>
          likedGuids.includes(value.frontmatter.guid)
        );
        const likedRules = reactedRules
          .map((r) => ({
            ...r.frontmatter,
            excerpt: r.excerpt,
            type: success.likesDislikedRules
              .filter((v) => v.ruleGuid == r.frontmatter.guid)
              .map((r) => r.type),
          }))
          .filter((rr) => rr.type[0] == 0);
        setLikedRules(likedRules);

        const dislikedRules = reactedRules
          .map((r) => ({
            ...r.frontmatter,
            excerpt: r.excerpt,
            type: success.likesDislikedRules
              .filter((v) => v.ruleGuid == r.frontmatter.guid)
              .map((r) => r.type),
          }))
          .filter((rr) => rr.type[0] == 1);
        setDislikedRules(dislikedRules);
      })
      .catch((err) => {
        console.error('error: ', err);
      });
  }

  useEffect(() => {
    if (userData) {
      getBookmarkList();
      getLikesDislikesLists();
    }
  }, [userData, filter, change]);
  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 radio-toolbar how-to-view text-center p-4 pl-10 d-print-none">
        <div>
          <input
            type="radio"
            id="customRadioInline1"
            name="customRadioInline1"
            className="custom-control-input"
            value="titleOnly"
            checked={viewStyle === 'titleOnly'}
            onChange={handleOptionChange}
          />
          <label
            className="view-title custom-control-label"
            htmlFor="customRadioInline1"
          >
            View titles only
          </label>
        </div>
        <div>
          <input
            type="radio"
            id="customRadioInline3"
            name="customRadioInline1"
            className="custom-control-input"
            value="blurb"
            checked={viewStyle === 'blurb'}
            onChange={handleOptionChange}
          />
          <label
            className="view-blurb custom-control-label"
            htmlFor="customRadioInline3"
          >
            Show Blurb
          </label>
        </div>
      </div>

      {bookmarkedRules && likedRules && dislikedRules ? (
        <RuleList
          rules={
            filter == 1
              ? bookmarkedRules
              : filter == 2
              ? likedRules
              : dislikedRules
          }
          viewStyle={viewStyle}
          type={filter == 1 ? 'bookmark' : filter == 2 ? 'like' : 'dislike'}
          onRemoveClick={onRemoveClick}
        />
      ) : (
        <p style={{ textAlign: 'center' }}>Loading...</p>
      )}
    </>
  );
};
ProfileContent.propTypes = {
  data: PropTypes.object.isRequired,
  filter: PropTypes.number.isRequired,
};

const RuleList = ({ rules, viewStyle, type, onRemoveClick }) => {
  const linkRef = useRef();
  return (
    <div className="p-12">
      {rules.toString() == '' || rules == undefined || !rules ? (
        <p style={{ textAlign: 'center' }}>No rules have been {type}d yet</p>
      ) : (
        <></>
      )}
      <ol className="rule-number">
        {rules.map((rule) => {
          return (
            <>
              <li className="pb-4">
                <section className="rule-content-title px-4">
                  <h2 style={{ display: 'flex' }}>
                    <Link ref={linkRef} to={`/${rule.uri}`}>
                      {rule.title}
                    </Link>
                    <FontAwesomeIcon
                      icon={faTrash}
                      color="black"
                      onClick={() => onRemoveClick(rule.guid)}
                      className="remove-item"
                    />
                  </h2>
                </section>
                <section
                  className={`rule-content px-4 mb-5
                            ${viewStyle === 'blurb' ? 'visible' : 'hidden'}`}
                >
                  <div dangerouslySetInnerHTML={{ __html: rule.excerpt }} />
                  <p className="pt-5 pb-0">
                    Read more about{' '}
                    <a href={rule.uri} className="underline">
                      {rule.title}
                    </a>
                  </p>
                </section>
              </li>
            </>
          );
        })}
      </ol>
    </div>
  );
};

RuleList.propTypes = {
  rules: PropTypes.array.isRequired,
  viewStyle: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  onRemoveClick: PropTypes.func.isRequired,
};

export default ProfileContent;
