import React from 'react';
import PropTypes from 'prop-types';
import PlaceHolderImage from '../../images/ssw-employee-profile-placeholder-sketch.jpg';
import useAppInsights from '../../hooks/useAppInsights';

const Acknowledgements = ({ authors, location }) => {
  const { trackTrace } = useAppInsights();

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
      trackTrace(`Profile title is missing at ${location.href}`, 2);
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
      <div className="flex flex-row flex-wrap justify-center">
        {authors &&
          authors.map((author, index) => (
            <div
              className="px-2 flex items-center my-2 justify-center"
              key={`author_${index}`}
            >
              <div
                className="w-16 h-16 overflow-hidden rounded-full"
                key={`author_${index}`}
              >
                <ProfileBadge author={author} />
              </div>
            </div>
          ))}
      </div>
    </>
  );
};

Acknowledgements.propTypes = {
  authors: PropTypes.any,
  author: PropTypes.any,
  location: PropTypes.object,
};

export default Acknowledgements;
