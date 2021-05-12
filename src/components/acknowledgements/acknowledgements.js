/* eslint-disable jsx-a11y/anchor-has-content */
import React from 'react';
import PropTypes from 'prop-types';
import PlaceHolderImage from '../../images/ssw-employee-profile-placeholder-sketch.jpg';

const Acknowledgements = ({ authors }) => {
  function ProfileBadge(props) {
    const author = props.author;
    return (
      <>
        <a href={author.url}>
          <ProfileImg author={author} />
        </a>
      </>
    );
  }

  ProfileBadge.propTypes = {
    author: PropTypes.any,
  };

  function ProfileImg(props) {
    const author = props.author;
    if (author.img && author.img.includes('http')) {
      return <img src={author.img} alt={author.title} title={author.title} />;
    } else if (
      (author.url && author.url.includes('https://ssw.com.au/people/')) ||
      author.url.includes('https://www.ssw.com.au/people/')
    ) {
      return (
        <img
          src={`https://github.com/SSWConsulting/SSW.People.Profiles/raw/main/${author.title.replace(
            / /g,
            '-'
          )}/Images/${author.title.replace(/ /g, '-')}-Profile.jpg`}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = PlaceHolderImage;
          }}
          alt={author.title}
          title={author.title}
        />
      );
    } else if (author.url && author.url.includes('https://github.com/')) {
      const gitHubUsername = author.url.split('https://github.com/')[1];
      return (
        <img
          src={`https://avatars.githubusercontent.com/${gitHubUsername}`}
          alt={author.title}
          title={author.title}
        />
      );
    } else {
      return (
        <img src={PlaceHolderImage} alt={author.title} title={author.title} />
      );
    }
  }

  return (
    <>
      <div className="info-link-grid-container">
        <h5>Acknowledgements</h5>
        <div className="info-tooltip">
          <a
            className="info-btn-container"
            href="https://github.com/SSWConsulting/SSW.Rules.Content/wiki/Editing-rules"
            target="_blank"
            rel="noopener noreferrer"
          />
          <span className="tooltiptext">How to add an Acknowledgement</span>
        </div>
      </div>
      <div className="flex flex-row flex-wrap justify-center">
        {authors &&
          authors.map((author, index) => (
            <div
              style={{
                width: '75px',
                height: '75px',
                overflow: 'hidden',
                borderRadius: '50%',
                marginRight: '10px',
              }}
              key={`author_${index}`}
            >
              <ProfileBadge author={author} />

              <span className="tooltiptext">{author.title}</span>
            </div>
          ))}
      </div>
    </>
  );
};

Acknowledgements.propTypes = {
  authors: PropTypes.any,
  author: PropTypes.any,
};

export default Acknowledgements;
