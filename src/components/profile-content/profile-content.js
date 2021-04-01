/* eslint-disable quotes */
/* eslint-disable prettier/prettier */
/* eslint-disable no-console */
import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'gatsby';
import {
  GetBookmarksForUser,
  GetAllLikedDisliked,
  RemoveBookmark,
  RemoveReaction,
  GetCommentSlug,
  GetDisqusUserCommentsList,
  GetDisqusUser,
  ConnectUserCommentsAccount,
  RemoveUserCommentsAccount,
  GetUser,
} from '../../services/apiService';
import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';
import DisqusIcon from '-!svg-react-loader!../../images/disqusIcon.svg';
import PrivacyToggle from '../../images/privacyToggle.png';
import MD from 'gatsby-custom-md';
import GreyBox from '../greybox/greybox';
import { useAuth0 } from '@auth0/auth0-react';
import { Filter } from '../profile-filter-menu/profile-filter-menu';

const ProfileContent = (props) => {
  const [bookmarkedRules, setBookmarkedRules] = useState();
  const [superLikedRulesList, setSuperLikedRules] = useState();
  const [likedRulesList, setLikedRules] = useState();
  const [dislikedRulesList, setDislikedRules] = useState();
  const [superDislikedRulesList, setSuperDislikedRules] = useState();
  const [commentedRulesList, setCommentedRulesList] = useState();
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

  async function getUserComments() {
    const jwt = await getIdTokenClaims();
    const commentedRuleGuids = [];
    GetUser(user.sub, jwt.__raw).then((success) => {
      setUserCommentsConnected(success.commentsConnected);
      if (!success.commentsConnected) {
        setCommentedRulesList([]);
      } else {
        GetDisqusUserCommentsList(success.user.commentsUserId)
          .then((success) => {
            if (success.code == 12) {
              setDisqusPrivacyEnabled(true);
            } else {
              const allRules = props.data.allMarkdownRemark.nodes;
              success.response.forEach((comment) => {
                GetCommentSlug(comment.thread)
                  .then((success) => {
                    commentedRuleGuids.push(success.response.identifiers[0]);
                    const commentedRulesMap = allRules.filter((value) =>
                      commentedRuleGuids.includes(value.frontmatter.guid)
                    );
                    const commentedRulesSpread = commentedRulesMap.map((r) => ({
                      ...r.frontmatter,
                      excerpt: r.excerpt,
                      htmlAst: r.htmlAst,
                    }));
                    setCommentedRulesList(commentedRulesSpread);
                    props.setCommentedRulesCount(commentedRulesSpread.length);
                  })
                  .catch((error) => console.error(error));
              });
            }
          })
          .catch((error) => console.error(error));
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
        console.error('error: ', err);
      });
  }

  useEffect(() => {
    if (isAuthenticated) {
      getBookmarkList();
      getLikesDislikesLists();
      getUserComments();
    }
  }, [isAuthenticated, props.filter, change, props.listChange]);
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
          setListChange={props.setListChangeCallback}
          listChange={props.listChange}
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

const RuleList = ({
  rules,
  viewStyle,
  type,
  onRemoveClick,
  userCommentsConnected,
  setListChange,
  listChange,
}) => {
  const linkRef = useRef();
  const iconClass = type.replace(/\s+/g, '-');
  const [disqusUsername, setDisqusUsername] = useState();
  const [usernameIsValid, setUsernameIsValid] = useState(true);

  const components = {
    greyBox: GreyBox,
  };
  const { user, getIdTokenClaims } = useAuth0();

  async function RemoveDisqusUser() {
    const jwt = await getIdTokenClaims();
    RemoveUserCommentsAccount({ UserId: user.sub }, jwt.__raw)
      .then(() => {
        setListChange(listChange + 1);
      })
      .catch((error) => {
        console.error(error);
      });
  }

  useEffect(() => {}, [userCommentsConnected, listChange]);

  return (
    <>
      {rules == undefined || rules.toString() == '' || !rules ? (
        type == 'comment' ? (
          !userCommentsConnected ? (
            <div className="connect-acc-container">
              <DisqusIcon className="disqus-large-icon" />
              <div className="form">
                <div>
                  <input
                    className={
                      usernameIsValid
                        ? 'username-input-box'
                        : 'username-input-box-error'
                    }
                    type="text"
                    name="disqusId"
                    onSubmit={console.log('Yep ')}
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
                  {!usernameIsValid ? (
                    <p className="error-text">Username does not exist</p>
                  ) : (
                    <></>
                  )}
                </div>

                <button
                  className="connect-acc-button"
                  onClick={() => {
                    if (disqusUsername) {
                      GetDisqusUser(disqusUsername)
                        .then(async (success) => {
                          if (success.code == 2) {
                            setUsernameIsValid(false);
                          }
                          const jwt = await getIdTokenClaims();
                          ConnectUserCommentsAccount(
                            {
                              UserId: user.sub,
                              CommentsUserId: success.response.id,
                            },
                            jwt.__raw
                          )
                            .then(() => {
                              setListChange(listChange + 1);
                            })
                            .catch((error) => {
                              console.error(error);
                            });
                        })
                        .catch((error) => {
                          console.error(error);
                        });
                    }
                  }}
                >
                  Connect Account
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="warning-box">
                SSW Rules cant see your comments!
                <p />
                Please go to your{' '}
                <a
                  href="https://disqus.com/home/settings/profile/"
                  className="disqus-profile-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  Disqus Profile{' '}
                </a>
                and disable <b>&#34;Keep your profile activity private&#34;</b>
              </div>
              <figure className="privacy-toggle-figure">
                <img
                  src={PrivacyToggle}
                  alt="Screenshot of privacy toggle"
                  className="privacy-toggle-image"
                />
                <figcaption className="privacy-toggle-caption">
                  Figure: Location of the privacy toggle (This is usually
                  disabled by default)
                </figcaption>
              </figure>
            </>
          )
        ) : (
          <>
            <div className="no-content-message">
              <p className="no-tagged-message">
                {type == 'comment'
                  ? "No comment? Don't be shy!"
                  : type == 'bookmark'
                  ? 'No bookmarks? Use them to save rules for later!'
                  : type == 'love'
                  ? 'Nothing here yet, show us the rules you love!'
                  : type == 'agree'
                  ? "There should be more here, don't you agree?"
                  : type == 'disagree'
                  ? 'What a happy chap you are, no disagreements here!'
                  : "Let us know what you don't like, we are here to improve!"}
              </p>
            </div>
          </>
        )
      ) : (
        <div className="p-12">
          <ol className="rule-number">
            {rules.map((rule) => {
              return (
                <>
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
                            <a className="disqus-comment-link" href={rule.url}>
                              {/* TODO: go to comment on rule */}
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
  setListChange: PropTypes.func,
  listChange: PropTypes.number,
};

export default ProfileContent;
