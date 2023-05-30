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
    if (author.noimage) {
      return (
        <img src={PlaceHolderImage} alt={author.title} title={author.title} />
      );
    } else if (author.img && author.img.includes('http')) {
      return <img src={author.img} alt={author.title} title={author.title} />;
    } else if (author.url && author.url.includes('ssw.com.au/people')) {
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
    } else if (author.url && author.url.includes('github.com/')) {
      const urlList = author.url.split('github.com/');
      const gitHubUsername = urlList[urlList.length - 1];
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
      <div className="flex flex-row flex-wrap lg:mb-8">
        {authors &&
          authors.map((author, index) => (
            <>
              <div
                className="pl-5 flex items-center my-2 w-full justify-center"
                key={`author_${index}`}
              >
                <div
                  className="w-12 h-12 overflow-hidden rounded-full mr-2.5"
                  key={`author_${index}`}
                >
                  <ProfileBadge author={author} />
                </div>
                <div className="ml-2.5 w-60 text-sm">
                  <a href={author.url}>{author.title}</a>
                </div>
              </div>
            </>
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
