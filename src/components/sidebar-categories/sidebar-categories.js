import React, { useRef } from 'react';
import { Link } from 'gatsby';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';
import {
  faAngleDoubleLeft,
  faAngleDoubleRight,
} from '@fortawesome/free-solid-svg-icons';

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

appInsights.loadAppInsights();

const Categories = ({ categories, location, rule }) => {
  const cat = location.state ? location.state.category : null;
  const linkRef = useRef();

  return (
    <>
      {cat && (
        <>
          {categories
            .filter((category) => category.parent.name === cat)
            .map((category, i) => {
              let indexCat = category.frontmatter.index.indexOf(
                rule.frontmatter.uri
              );
              return (
                <div
                  className="flex py-2 text-sm items-center justify-center"
                  key={i}
                >
                  <div className="box-border cursor-pointer text-lg font-medium text-black hover:text-ssw-red">
                    {indexCat > 0 && (
                      <Link
                        ref={linkRef}
                        to={`/${category.frontmatter.index[indexCat - 1]}`}
                        state={{ category: cat }}
                        onClick={() => {
                          appInsights.trackEvent({
                            name: 'PreviousButtonPressed',
                          });
                        }}
                      >
                        <FontAwesomeIcon icon={faAngleDoubleLeft} />
                      </Link>
                    )}
                    {indexCat == 0 && (
                      <span className="box-border cursor-pointer text-lg font-medium text-slate-200">
                        <FontAwesomeIcon icon={faAngleDoubleLeft} />
                      </span>
                    )}
                  </div>
                  <span className="mx-6 select-none bg-ssw-red px-2.5 py-1 rounded hover:opacity-80 transition-colors duration-250 ease-in cursor-pointer">
                    <Link
                      ref={linkRef}
                      to={`/${category.parent.name}`}
                      style={{ color: '#fff' }}
                    >
                      {category.frontmatter.title.replace(
                        /Rules to(?: Better)?/,
                        ''
                      )}
                    </Link>
                  </span>
                  <div className="box-border cursor-pointer text-lg font-medium text-black hover:text-ssw-red">
                    {indexCat < category.frontmatter.index.length - 1 && (
                      <Link
                        ref={linkRef}
                        to={`/${category.frontmatter.index[indexCat + 1]}`}
                        state={{ category: cat }}
                        onClick={() => {
                          appInsights.trackEvent({
                            name: 'NextButtonPressed',
                          });
                        }}
                      >
                        <FontAwesomeIcon icon={faAngleDoubleRight} />
                      </Link>
                    )}
                    {indexCat == category.frontmatter.index.length - 1 && (
                      <span className="box-border cursor-pointer text-lg font-medium text-slate-200">
                        <FontAwesomeIcon icon={faAngleDoubleRight} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </>
      )}

      <div className="flex flex-col py-1 text-sm items-center justify-center">
        {categories
          .filter((category) => category.parent.name !== cat)
          .map((category, i) => (
            <div className="px-1 inline my-2" key={i}>
              <span className="select-none bg-ssw-red px-1.5 py-1 rounded hover:opacity-80 transition-colors duration-250 ease-in cursor-pointer">
                <Link
                  ref={linkRef}
                  to={`/${category.parent.name}`}
                  style={{ color: '#fff' }}
                >
                  {category.frontmatter.title.replace(
                    /Rules to(?: Better)?/,
                    ''
                  )}
                </Link>
              </span>
            </div>
          ))}
        {rule.frontmatter.archivedreason?.length > 0 && (
          <div className="inline px-1">
            <span className="select-none bg-ssw-red px-1.5 py-1 rounded hover:opacity-80 transition-colors duration-250 ease-in cursor-pointer">
              <Link ref={linkRef} to={'/archived'} style={{ color: '#fff' }}>
                Archived
              </Link>
            </span>
          </div>
        )}
      </div>
    </>
  );
};

Categories.propTypes = {
  categories: PropTypes.array,
  location: PropTypes.object,
  rule: PropTypes.object,
};

export default Categories;
