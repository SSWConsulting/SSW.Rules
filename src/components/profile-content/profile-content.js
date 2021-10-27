/* eslint-disable no-undef */
/* eslint-disable quotes */
import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'gatsby';
import {
  GetBookmarksForUser,
  GetAllLikedDisliked,
  RemoveBookmark,
  RemoveReaction,
  GetDisqusUserCommentsList,
  RemoveUserCommentsAccount,
  GetUser,
  DisqusError,
} from '../../services/apiService';
import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';
import DisqusIcon from '-!svg-react-loader!../../images/disqusIcon.svg';

import MD from 'gatsby-custom-md';
import GreyBox from '../greybox/greybox';
import { useAuth0 } from '@auth0/auth0-react';
import { Filter } from '../profile-filter-menu/profile-filter-menu';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

import CommentsNotConnected from '../comments-not-connected/comments-not-connected';
import DisableDisqusPrivacy from '../disable-disqus-privacy/disable-disqus-privacy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowCircleRight } from '@fortawesome/free-solid-svg-icons';

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

const ProfileContent = (props) => {
  const [bookmarkedRules, setBookmarkedRules] = useState([]);
  const [superLikedRulesList, setSuperLikedRules] = useState([]);
  const [likedRulesList, setLikedRules] = useState([]);
  const [dislikedRulesList, setDislikedRules] = useState([]);
  const [superDislikedRulesList, setSuperDislikedRules] = useState([]);
  const [commentedRulesList, setCommentedRulesList] = useState([]);
  const [userCommentsConnected, setUserCommentsConnected] = useState(true);
  const [disqusPrivacyEnabled, setDisqusPrivacyEnabled] = useState(false);
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
              props.setState(props.state + 1);
            })
            .catch((err) => {
              appInsights.trackException({
                error: new Error(err),
                severityLevel: 3,
              });
            })
        : RemoveReaction({ ruleGuid: ruleGuid, UserId: user.sub }, jwt.__raw)
            .then(() => {
              setChange(change + 1);
            })
            .catch((err) => {
              appInsights.trackException({
                error: new Error(err),
                severityLevel: 3,
              });
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
        appInsights.trackException({
          error: new Error(err),
          severityLevel: 3,
        });
      });
  }

  async function setCommentedRulesFromGuids(response) {
    const commentedRuleGuids = response.map((post) => {
      if (post.forum == process.env.DISQUS_FORUM) {
        return post.thread.identifiers[0];
      }
    });

    const allRules = props.data.allMarkdownRemark.nodes;

    const commentedRulesMap = allRules.filter((value) =>
      commentedRuleGuids.includes(value.frontmatter.guid)
    );

    const commentedRulesSpread = commentedRulesMap.map((r) => ({
      ...r.frontmatter,
      excerpt: r.excerpt,
      htmlAst: r.htmlAst,
    }));
    if (commentedRulesSpread) {
      setCommentedRulesList(commentedRulesSpread);
      props.setCommentedRulesCount(commentedRulesSpread.length);
    }
  }

  async function getUserComments() {
    const jwt = await getIdTokenClaims();
    GetUser(user.sub, jwt.__raw).then((success) => {
      setUserCommentsConnected(success.commentsConnected);
      if (!success.commentsConnected) {
        setCommentedRulesList([]);
      } else {
        GetDisqusUserCommentsList(success.user.commentsUserId)
          .then((success) => {
            if (success.code == DisqusError.AccessTooLow) {
              // eslint-disable-next-line no-console
              console.log('This error was expected and handled');
              setDisqusPrivacyEnabled(true);
            } else {
              setCommentedRulesFromGuids(success.response);
            }
          })
          .catch((err) => {
            appInsights.trackException({
              error: new Error(err),
              severityLevel: 3,
            });
          });
      }
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
        setLikedRules(likedRules ? likedRules : []);
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
        setDislikedRules(dislikedRules ? dislikedRules : []);
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
        appInsights.trackException({
          error: new Error(err),
          severityLevel: 3,
        });
      });
  }

  useEffect(() => {
    if (isAuthenticated) {
      getBookmarkList();
      getLikesDislikesLists();
      getUserComments();
    }
  }, [isAuthenticated, props.filter, change, props.state]);
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
          userCommentsConnected={userCommentsConnected}
          disqusPrivacyEnabled={disqusPrivacyEnabled}
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
          setState={props.setState}
          state={props.state}
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
  setState: PropTypes.func.isRequired,
  state: PropTypes.number.isRequired,
  setBookmarkedRulesCount: PropTypes.func.isRequired,
  setSuperLikedRulesCount: PropTypes.func.isRequired,
  setLikedRulesCount: PropTypes.func.isRequired,
  setDislikedRulesCount: PropTypes.func.isRequired,
  setSuperDislikedRulesCount: PropTypes.func.isRequired,
  setCommentedRulesCount: PropTypes.func.isRequired,
};

const RuleList = ({
  rules,
  viewStyle,
  type,
  onRemoveClick,
  userCommentsConnected,
  setState,
  state,
  disqusPrivacyEnabled,
}) => {
  const linkRef = useRef();
  const iconClass = type.replace(/\s+/g, '-');

  const components = {
    greyBox: GreyBox,
  };
  const { user, getIdTokenClaims } = useAuth0();

  async function RemoveDisqusUser() {
    const jwt = await getIdTokenClaims();
    RemoveUserCommentsAccount({ UserId: user.sub }, jwt.__raw)
      .then(() => {
        setState(state + 1);
      })
      .catch((err) => {
        appInsights.trackException({
          error: new Error(err),
          severityLevel: 3,
        });
      });
  }

  useEffect(() => {}, [userCommentsConnected, state]);

  return (
    <>
      {rules.length == 0 ? (
        type == 'comment' ? (
          !userCommentsConnected ? (
            <CommentsNotConnected
              userCommentsConnected={userCommentsConnected}
              state={state}
              setState={setState}
              key={type}
            />
          ) : disqusPrivacyEnabled ? (
            <DisableDisqusPrivacy />
          ) : (
            <>
              <div className="no-content-message">
                <p className="no-tagged-message">
                  No comment? Don{"'"}t be shy!
                </p>
              </div>
            </>
          )
        ) : (
          <>
            <div className="no-content-message">
              <p className="no-tagged-message">
                {type == 'bookmark'
                  ? 'No bookmarks? Use them to save rules for later!'
                  : type == 'love'
                  ? 'Nothing here yet, show us the rules you love!'
                  : type == 'agree'
                  ? `There should be more here, don${"'"}t you agree?`
                  : type == 'disagree'
                  ? 'What a happy chap you are, no disagreements here!'
                  : `Let us know what you don${"'"}t like, we are here to improve!`}
              </p>
            </div>
          </>
        )
      ) : (
        <div className="p-12">
          <ol className="rule-number">
            {rules.map((rule) => {
              return (
                <li key={rule.guid}>
                  <section className="rule-content-title pl-2 pb-4">
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
                        <div className="disqus-tooltip">
                          <a
                            className="disqus-comment-link"
                            href={rule.uri + '#disqus_thread'}
                          >
                            <DisqusIcon />
                          </a>
                          <span className="tooltiptext">See on rule</span>{' '}
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
                    className={`rule-content px-4 mb-4
                            ${viewStyle === 'all' ? 'visible' : 'hidden'}`}
                  >
                    <MD components={components} htmlAst={rule.htmlAst} />
                  </section>
                  <section
                    className={`rule-content px-4 mb-4 pb-4
                            ${viewStyle === 'blurb' ? 'visible' : 'hidden'}`}
                  >
                    <div dangerouslySetInnerHTML={{ __html: rule.excerpt }} />
                    <p className="pt-5 pb-0">
                      <Link
                        ref={linkRef}
                        to={`/${rule.uri}`}
                        title={`Read more about ${rule.title}`}
                      >
                        <FontAwesomeIcon icon={faArrowCircleRight} /> Read more
                      </Link>
                    </p>
                  </section>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {type == 'comment' && userCommentsConnected ? (
        <button className="disconnect-acc-button" onClick={RemoveDisqusUser}>
          Disconnect Disqus account <DisqusIcon />
        </button>
      ) : (
        <></>
      )}
    </>
  );
};

RuleList.propTypes = {
  rules: PropTypes.array.isRequired,
  viewStyle: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  onRemoveClick: PropTypes.func.isRequired,
  userCommentsConnected: PropTypes.bool,
  setState: PropTypes.func,
  state: PropTypes.number,
  disqusPrivacyEnabled: PropTypes.bool,
};

export default ProfileContent;
