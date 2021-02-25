/* eslint-disable no-console */
import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'gatsby';
import {
  GetBookmarksForUser,
  GetAllLikedDisliked,
  RemoveBookmark,
  RemoveReaction,
  GetUserComments,
} from '../../services/apiService';
import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';
import GitHubIcon from '-!svg-react-loader!../../images/github.svg';
import MD from 'gatsby-custom-md';
import GreyBox from '../greybox/greybox';
import { useAuth0 } from '@auth0/auth0-react';
import { Filter } from '../profile-filter-menu/profile-filter-menu';
import { commentsRepository } from '../../../site-config';

const ProfileContent = (props) => {
  const [bookmarkedRules, setBookmarkedRules] = useState();
  const [superLikedRulesList, setSuperLikedRules] = useState();
  const [likedRulesList, setLikedRules] = useState();
  const [dislikedRulesList, setDislikedRules] = useState();
  const [superDislikedRulesList, setSuperDislikedRules] = useState();
  const [commentedRulesList, setCommentedRulesList] = useState();
  const [change, setChange] = useState(0);
  const [viewStyle, setViewStyle] = useState('titleOnly');
  const { user, getIdTokenClaims, isAuthenticated } = useAuth0();

  const handleOptionChange = (e) => {
    setViewStyle(e.target.value);
  };

  async function onRemoveClick(ruleGuid) {
    const jwt = await getIdTokenClaims();
    if (
      isAuthenticated &&
      window.confirm('Are you sure you want to remove this tag?')
    ) {
      props.filter == Filter.Bookmarks
        ? RemoveBookmark({ ruleGuid: ruleGuid, UserId: user.sub }, jwt.__raw)
            .then(() => {
              setChange(change + 1);
              props.setListChangeCallback(props.listChange + 1);
            })
            .catch((err) => {
              console.error('error: ' + err);
            })
        : RemoveReaction({ ruleGuid: ruleGuid, UserId: user.sub }, jwt.__raw)
            .then(() => {
              setChange(change + 1);
            })
            .catch((err) => {
              console.error('error: ' + err);
            });
    }
  }

  function getBookmarkList() {
    GetBookmarksForUser(user.sub)
      .then((success) => {
        const allRules = props.data.allMarkdownRemark.nodes;
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
          htmlAst: r.htmlAst,
        }));
        setBookmarkedRules(bookmarkedRulesSpread);
        props.setBookmarkedRulesCount(bookmarkedRulesSpread.length);
      })
      .catch((err) => {
        console.error('error: ', err);
      });
  }

  function getUserComments() {
    GetUserComments(user.nickname, commentsRepository)
      .then((success) => {
        const allRules = props.data.allMarkdownRemark.nodes;
        const commentGuids =
          success.items.size != 0 ? success.items.map((r) => r.title) : null;
        const commentedRulesMap = allRules.filter((value) =>
          commentGuids.includes(value.frontmatter.guid)
        );
        const commentedRulesSpread = commentedRulesMap.map((r) => ({
          ...r.frontmatter,
          excerpt: r.excerpt,
          htmlAst: r.htmlAst,
          url: success.items
            .filter((v) => v.title == r.frontmatter.guid)
            .map((r) => r.html_url)[0],
        }));
        setCommentedRulesList(commentedRulesSpread);
        props.setCommentedRulesCount(commentedRulesSpread.length);
      })
      .catch((err) => {
        console.error('error: ', err);
      });
  }

  function getLikesDislikesLists() {
    GetAllLikedDisliked(user.sub)
      .then((success) => {
        const allRules = props.data.allMarkdownRemark.nodes;
        const reactedGuids = success.likesDislikedRules.map((r) => r.ruleGuid);
        const reactedRules = allRules.filter((value) =>
          reactedGuids.includes(value.frontmatter.guid)
        );
        const superLikedRules = reactedRules
          .map((r) => ({
            ...r.frontmatter,
            excerpt: r.excerpt,
            htmlAst: r.htmlAst,
            type: success.likesDislikedRules
              .filter((v) => v.ruleGuid == r.frontmatter.guid)
              .map((r) => r.type),
          }))
          .filter((rr) => rr.type[0] == Filter.SuperLikes);
        setSuperLikedRules(superLikedRules);
        props.setSuperLikedRulesCount(superLikedRules.length);

        const likedRules = reactedRules
          .map((r) => ({
            ...r.frontmatter,
            excerpt: r.excerpt,
            htmlAst: r.htmlAst,
            type: success.likesDislikedRules
              .filter((v) => v.ruleGuid == r.frontmatter.guid)
              .map((r) => r.type),
          }))
          .filter((rr) => rr.type[0] == Filter.Likes);
        setLikedRules(likedRules);
        props.setLikedRulesCount(likedRules.length);

        const dislikedRules = reactedRules
          .map((r) => ({
            ...r.frontmatter,
            excerpt: r.excerpt,
            htmlAst: r.htmlAst,
            type: success.likesDislikedRules
              .filter((v) => v.ruleGuid == r.frontmatter.guid)
              .map((r) => r.type),
          }))
          .filter((rr) => rr.type[0] == Filter.Dislikes);
        setDislikedRules(dislikedRules);
        props.setDislikedRulesCount(dislikedRules.length);

        const superDislikedRules = reactedRules
          .map((r) => ({
            ...r.frontmatter,
            excerpt: r.excerpt,
            htmlAst: r.htmlAst,
            type: success.likesDislikedRules
              .filter((v) => v.ruleGuid == r.frontmatter.guid)
              .map((r) => r.type),
          }))
          .filter((rr) => rr.type[0] == Filter.SuperDislikes);
        setSuperDislikedRules(superDislikedRules);
        props.setSuperDislikedRulesCount(superDislikedRules.length);
      })
      .catch((err) => {
        console.error('error: ', err);
      });
  }

  useEffect(() => {
    if (isAuthenticated) {
      getBookmarkList();
      getLikesDislikesLists();
      getUserComments();
    }
  }, [isAuthenticated, props.filter, change]);
  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 radio-toolbar how-to-view text-center p-4 d-print-none pt-12">
        <div className="radio-button-1">
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
        <div className="radio-button-2">
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
        <div className="radio-button-3">
          <input
            type="radio"
            id="customRadioInline2"
            name="customRadioInline1"
            className="custom-control-input"
            value="all"
            checked={viewStyle === 'all'}
            onChange={handleOptionChange}
          />
          <label
            className="view-full custom-control-label ml-1"
            htmlFor="customRadioInline2"
          >
            Gimme everything!
          </label>
        </div>
      </div>
      {bookmarkedRules && likedRulesList && dislikedRulesList ? (
        <RuleList
          rules={
            props.filter == Filter.Bookmarks
              ? bookmarkedRules
              : props.filter == Filter.SuperLikes
              ? superLikedRulesList
              : props.filter == Filter.Likes
              ? likedRulesList
              : props.filter == Filter.Dislikes
              ? dislikedRulesList
              : props.filter == Filter.SuperDislikes
              ? superDislikedRulesList
              : commentedRulesList
          }
          viewStyle={viewStyle}
          type={
            props.filter == Filter.Bookmarks
              ? 'bookmark'
              : props.filter == Filter.Likes
              ? 'agree'
              : props.filter == Filter.Dislikes
              ? 'disagree'
              : props.filter == Filter.SuperDislikes
              ? 'no way'
              : props.filter == Filter.SuperLikes
              ? 'love'
              : 'comment'
          }
          onRemoveClick={onRemoveClick}
        />
      ) : (
        <p className="no-content-message">Loading...</p>
      )}
    </>
  );
};
ProfileContent.propTypes = {
  data: PropTypes.object.isRequired,
  filter: PropTypes.number.isRequired,
  setListChangeCallback: PropTypes.func.isRequired,
  listChange: PropTypes.number.isRequired,
  setBookmarkedRulesCount: PropTypes.func.isRequired,
  setSuperLikedRulesCount: PropTypes.func.isRequired,
  setLikedRulesCount: PropTypes.func.isRequired,
  setDislikedRulesCount: PropTypes.func.isRequired,
  setSuperDislikedRulesCount: PropTypes.func.isRequired,
  setCommentedRulesCount: PropTypes.func.isRequired,
};

const RuleList = ({ rules, viewStyle, type, onRemoveClick }) => {
  const linkRef = useRef();
  const iconClass = type.replace(/\s+/g, '-');
  const components = {
    greyBox: GreyBox,
  };
  return (
    <>
      {rules == undefined || rules.toString() == '' || !rules ? (
        <div className="no-content-message">
          <p className="no-tagged-message">No tagged rules yet.</p>
        </div>
      ) : (
        <div className="p-12">
          <ol className="rule-number">
            {rules.map((rule) => {
              return (
                <>
                  <li>
                    <section className="rule-content-title px-4 pb-4">
                      <div className="heading-container">
                        <h2 className={`rule-heading-${iconClass}`}>
                          <Link ref={linkRef} to={`/${rule.uri}`}>
                            {rule.title}
                          </Link>
                        </h2>

                        {type == 'bookmark' ? (
                          <BookmarkIcon
                            className="profile-bookmark-icon"
                            color="#cc4141"
                          />
                        ) : (
                          ''
                        )}
                        {type == 'comment' ? (
                          <div className="github-tooltip">
                            <a className="github-comment-link" href={rule.url}>
                              <GitHubIcon />
                            </a>
                            <span className="tooltiptext">Edit in GitHub</span>{' '}
                          </div>
                        ) : (
                          <button
                            className="remove-item"
                            onClick={() => onRemoveClick(rule.guid)}
                          ></button>
                        )}
                      </div>
                    </section>
                    <section
                      className={`rule-content px-4 mb-5
                            ${viewStyle === 'all' ? 'visible' : 'hidden'}`}
                    >
                      <MD components={components} htmlAst={rule.htmlAst} />
                    </section>
                    <section
                      className={`rule-content px-4 mb-5 pb-4
                            ${viewStyle === 'blurb' ? 'visible' : 'hidden'}`}
                    >
                      <div dangerouslySetInnerHTML={{ __html: rule.excerpt }} />
                      <p className="pt-5 pb-0">
                        Read more about{' '}
                        <Link ref={linkRef} to={`/${rule.uri}`}>
                          {rule.title}
                        </Link>
                      </p>
                    </section>
                  </li>
                </>
              );
            })}
          </ol>
        </div>
      )}
    </>
  );
};

RuleList.propTypes = {
  rules: PropTypes.array.isRequired,
  viewStyle: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  onRemoveClick: PropTypes.func.isRequired,
};

export default ProfileContent;
