import React from 'react';
import PropTypes from 'prop-types';

const Acknowledgements = ({ authors }) => {

  function ProfileBadge(props) {
    const author = props.author;
    return (
      <>
      <a href={author.url} >
        <ProfileImg author={author}/>
    </a>
    </>
    );
  }

  function ProfileImg(props) {
    const author = props.author;

    if(author.url.includes("https://ssw.com.au/people/"))
    {
      return (
        <img
        src={`https://github.com/SSWConsulting/SSW.People.Profiles/raw/main/${author.title.replace(
          / /g,
          '-'
        )}/Images/${author.title.replace(
          / /g,
          '-'
        )}-Profile.jpg`}
        alt={author.title}
      />
      );
    } else if (author.url.includes("https://github.com/"))
    {
      const gitHubUsername = author.url.split('https://github.com/')[1];

      return (
        <img
        src={`https://avatars.githubusercontent.com/${gitHubUsername}`}
        alt={author.title}
      />
      );
    } else {
      return (
        <img
        src={`data:image/jpeg;base64,/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAABQAAD/4QMuaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzE0OCA3OS4xNjQwMzYsIDIwMTkvMDgvMTMtMDE6MDY6NTcgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCAyMS4xIChNYWNpbnRvc2gpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjZDNjJDQ0EwOEQzNjExRUE5MDAzODAwMkNENDBFNEY0IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkE1ODUyOTQyOEQzNjExRUE5MDAzODAwMkNENDBFNEY0Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6NkM2MkNDOUU4RDM2MTFFQTkwMDM4MDAyQ0Q0MEU0RjQiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6NkM2MkNDOUY4RDM2MTFFQTkwMDM4MDAyQ0Q0MEU0RjQiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7/7gAOQWRvYmUAZMAAAAAB/9sAhAACAgICAgICAgICAwICAgME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`}
        alt={author.title}
      />
      );
    }
  }

  return (
    <>
    <h5>Acknowledgements</h5>
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
};

export default Acknowledgements;