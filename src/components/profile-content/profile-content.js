/* eslint-disable no-console */
import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'gatsby';
import {
  GetBookmarksForUser,
  GetAllLikedDisliked,
  RemoveBookmark,
  RemoveReaction,
} from '../../services/apiService';
import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';
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
  const [change, setChange] = useState(0);
  const [viewStyle, setViewStyle] = useState('titleOnly');
  const { user, getIdTokenClaims } = useAuth0();

  const handleOptionChange = (e) => {
    setViewStyle(e.target.value);
  };

  async function onRemoveClick(ruleGuid) {
    const jwt = await getIdTokenClaims();
    if (
      user &&
      window.confirm(
        `Are you sure you want to remove this ${
          props.filter == Filter.Bookmarks ? 'bookmark' : 'reaction'
        }?`
      )
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
    if (user) {
      getBookmarkList();
      getLikesDislikesLists();
    }
  }, [user, props.filter, change]);
  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 radio-toolbar how-to-view text-center p-4 d-print-none">
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
              : superDislikedRulesList
          }
          viewStyle={viewStyle}
          type={
            props.filter == Filter.Bookmarks
              ? 'bookmark'
              : props.filter == Filter.Likes
              ? 'somewhat agree'
              : props.filter == Filter.Dislikes
              ? 'somewhat disagree'
              : props.filter == Filter.SuperDislikes
              ? 'disagree'
              : 'agree'
          }
          onRemoveClick={onRemoveClick}
        />
      ) : (
        <p className="logged-out-message">Loading...</p>
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
};

const RuleList = ({ rules, viewStyle, type, onRemoveClick }) => {
  const linkRef = useRef();
  const iconClass = type.replace(/\s+/g, '-');
  const components = {
    greyBox: GreyBox,
  };
  return (
    <div className="p-12">
      {rules.toString() == '' || rules == undefined || !rules ? (
        <p className="logged-out-message">
          No rules have been {type == 'bookmark' ? 'bookmarke' : type}d yet
        </p>
      ) : (
        <></>
      )}
      <ol className="rule-number">
        {rules.map((rule) => {
          return (
            <>
              <li className="pb-4">
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
                    <button
                      className="remove-item"
                      onClick={() => onRemoveClick(rule.guid)}
                    ></button>
                  </div>
                </section>
                <section
                  className={`rule-content px-4 mb-5
                            ${viewStyle === 'all' ? 'visible' : 'hidden'}`}
                >
                  <MD components={components} htmlAst={rule.htmlAst} />
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
