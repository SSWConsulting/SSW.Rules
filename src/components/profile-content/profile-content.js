import BookmarkIcon from '-!svg-react-loader!../../images/bookmarkIcon.svg';
import { useAuth0 } from '@auth0/auth0-react';
import {
  faArrowCircleRight,
  faBook,
  faFileLines,
  faQuoteLeft,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'gatsby';
import MD from 'gatsby-custom-md';
import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';
import useAppInsights from '../../hooks/useAppInsights';
import { GetBookmarksForUser, RemoveBookmark } from '../../services/apiService';
import { useAuthService } from '../../services/authService';
import GreyBox from '../greybox/greybox';
import { Filter } from '../profile-filter-menu/profile-filter-menu';
import RadioButton from '../radio-button/radio-button';

const ProfileContent = (props) => {
  const [bookmarkedRules, setBookmarkedRules] = useState([]);
  const [change, setChange] = useState(0);
  const [viewStyle, setViewStyle] = useState('titleOnly');
  const { user, isAuthenticated } = useAuth0();
  const { fetchIdToken } = useAuthService();
  const { trackException } = useAppInsights();
  const handleOptionChange = (e) => {
    setViewStyle(e.target.value);
  };

  async function onRemoveClick(ruleGuid) {
    const jwt = await fetchIdToken();
    if (
      isAuthenticated &&
      window.confirm('Are you sure you want to remove this tag?')
    ) {
      if (props.filter == Filter.Bookmarks) {
        RemoveBookmark({ ruleGuid: ruleGuid, UserId: user.sub }, jwt)
          .then(() => {
            setChange(change + 1);
            props.setState(props.state + 1);
          })
          .catch((err) => {
            trackException(err, 3);
          });
      }
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
        trackException(err, 3);
      });
  }

  useEffect(() => {
    if (isAuthenticated) {
      getBookmarkList();
    }
  }, [isAuthenticated, props.filter, change, props.state]);

  return (
    <>
      <div className="border-b border-solid border-b-gray-100 grid grid-cols-1 gap-5 p-4 text-center lg:grid-cols-5">
        <div></div>
        <RadioButton
          id="customRadioInline1"
          name="customRadioInline1"
          value="titleOnly"
          selectedOption={viewStyle}
          handleOptionChange={handleOptionChange}
          labelText="View titles only"
          icon={faQuoteLeft}
        />
        <RadioButton
          id="customRadioInline3"
          name="customRadioInline1"
          value="blurb"
          selectedOption={viewStyle}
          handleOptionChange={handleOptionChange}
          labelText="Show blurb"
          icon={faFileLines}
        />
        <RadioButton
          id="customRadioInline2"
          name="customRadioInline1"
          value="all"
          selectedOption={viewStyle}
          handleOptionChange={handleOptionChange}
          labelText="Gimme everything!"
          icon={faBook}
        />
      </div>
      {bookmarkedRules ? (
        <RuleList
          rules={props.filter == Filter.Bookmarks ? bookmarkedRules : null}
          viewStyle={viewStyle}
          state={props.state}
          type={props.filter == Filter.Bookmarks ? 'bookmark' : ''}
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
};

const RuleList = ({ rules, viewStyle, type, onRemoveClick, state }) => {
  const linkRef = useRef();
  const iconClass = type.replace(/\s+/g, '-');
  const components = {
    greyBox: GreyBox,
  };

  useEffect(() => {}, [state]);

  return (
    <>
      {rules.length == 0 ? (
        <>
          <div className="no-content-message">
            <p className="no-tagged-message">
              {type == 'bookmark'
                ? 'No bookmarks? Use them to save rules for later!'
                : ''}
            </p>
          </div>
        </>
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
                        <>
                          <button
                            className="remove-item"
                            onClick={() => onRemoveClick(rule.guid)}
                          >
                            <BookmarkIcon
                              className="profile-bookmark-icon"
                              color="#cc4141"
                            />
                          </button>
                        </>
                      ) : (
                        ''
                      )}
                    </div>
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
                  <section
                    className={`rule-content px-4 mb-4
                            ${viewStyle === 'all' ? 'visible' : 'hidden'}`}
                  >
                    <MD components={components} htmlAst={rule.htmlAst} />
                  </section>
                </li>
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
  state: PropTypes.number,
};

export default ProfileContent;
