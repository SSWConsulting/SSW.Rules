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

  function ProfileImg({ author }) {
    const { noimage, img, title, url } = author;

    if (!title) {
      // eslint-disable-next-line no-console
      console.warn('Warning: Title is missing.');
    }

    const getImgSource = () => {
      if (noimage) {
        return PlaceHolderImage;
      } else if (img?.includes('http')) {
        return img;
      } else if (url?.includes('ssw.com.au/people')) {
        const formattedTitle = title?.replace(/ /g, '-');
        return `https://github.com/SSWConsulting/SSW.People.Profiles/raw/main/${formattedTitle}/Images/${formattedTitle}-Profile.jpg`;
      } else if (url?.includes('github.com/')) {
        const urlList = url.split('github.com/');
        const gitHubUsername = urlList[urlList.length - 1];
        return `https://avatars.githubusercontent.com/${gitHubUsername}`;
      } else {
        return PlaceHolderImage;
      }
    };

    return (
      <img
        src={getImgSource()}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = PlaceHolderImage;
        }}
        alt={title}
        title={title}
      />
    );
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
