import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'gatsby';
import Icon from '../../images/icon.png';
import { parentSiteUrl, siteUrl } from '../../../site-config';

const Breadcrumbs = (props) => {
  const linkRef = useRef();
  const getCategories = () => {
    props.categories.push({ link: '/', title: 'This is another category' });
    props.categories.push({ link: '/', title: 'This is another category' });
    return (
      <div style={{ display: 'inline' }}>
        {props.categories.map((cat, i) => {
          return (
            <>
              <div key={i} className="breadcrumb-category">
                <Link
                  ref={linkRef}
                  to={cat.link}
                  className="breadcrumb-content"
                >
                  {cat.title}
                </Link>
              </div>
            </>
          );
        })}
      </div>
    );
  };

  return (
    <div className="breadcrumb-container">
      <div className="mx-4 mb-4 breadcrumb">
        <a href={parentSiteUrl}>
          <img
            alt={'SSW Consulting'}
            src={Icon}
            className="w-4"
            style={{ marginTop: '0px' }}
          />
        </a>

        <div>
          <ul>
            <li>
              <Link ref={linkRef} to={siteUrl} className="breadcrumb-content">
                SSW Rules
              </Link>
            </li>
            {props.categories && <li>{getCategories()}</li>}
            {props.isArchived ? (
              <li>Archived</li>
            ) : props.isCategory ? (
              <li>{props.categoryTitle}</li>
            ) : (
              <li>{props.title}</li>
            )}
          </ul>
        </div>

        {
          //TODO: Remove Dead Code
          /* <span className="pl-1 breadcrumb__separator">&gt;</span>
        <Link ref={linkRef} to={siteUrl}>
          <div className="breadcrumb-content px-1 hover:text-red-600">
            SSW Rules
          </div>
        </Link>

        <span className="px-1">
          {props.isCategory || props.isRule || props.isArchived ? '>' : ''}
        </span>
        {props.categories && (
          <div className="text-left ">{getCategories()}</div>
        )}
        {props.isArchived ? (
          <div className="px-1">Archived</div>
        ) : props.isCategory ? (
          <div className="px-1">{props.categoryTitle}</div>
        ) : (
          <div>
            <span className="px-1">{props.isHomePage ? '' : '>'}</span>
            {props.title}
          </div>
        )} */
        }
      </div>
    </div>
  );
};

Breadcrumbs.propTypes = {
  title: PropTypes.any,
  categories: PropTypes.array,
  categoryTitle: PropTypes.string,
  isCategory: PropTypes.bool,
  isRule: PropTypes.bool,
  isHomePage: PropTypes.bool,
  isArchived: PropTypes.bool,
};

export default Breadcrumbs;
