import Contact from '../contact/contact';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import GavelIcon from '-!svg-react-loader!../../images/gavel.svg';
import { NumericFormat } from 'react-number-format';
import PropTypes from 'prop-types';
import React from 'react';
import { RulesWidget } from 'ssw.rules.widget';
import { faQuoteLeft, faQuoteRight } from '@fortawesome/free-solid-svg-icons';
import { faTwitter } from '@fortawesome/free-brands-svg-icons';

const SideBar = ({ ruleTotalNumber, hideCount }) => {
  return (
    <div>
      <section className="rules-counter">
        {!hideCount && (
          <div className="grid grid-cols-6">
            <div className="col-span-1 col-start-2">
              <GavelIcon className="gavel-icon" />
            </div>
            <div className="col-span-2">
              <div className="text-3xl font-semibold text-ssw-red">
                <NumericFormat
                  value={ruleTotalNumber}
                  displayType={'text'}
                  thousandSeparator={true}
                />
              </div>
              <p>SSW Rules</p>
            </div>
          </div>
        )}
      </section>

      <section id="widget">
        <RulesWidget location={process.env.SITE_URL} numberOfRules={5} />
      </section>
      <section>
        <h4>Why all these rules?</h4>
        <p>
          Read about the{' '}
          <a
            href="https://www.codemag.com/article/0605091"
            target="_blank"
            rel="noopener noreferrer"
          >
            History of SSW Rules
          </a>
          , published in CoDe Magazine.
        </p>
      </section>
      <section>
        <div className="testimonial text-center rounded p-3">
          <h4>Help improve our rules</h4>
          <blockquote>
            <FontAwesomeIcon icon={faQuoteLeft} /> The SSW Rules website works
            just like Wikipedia. If you think something should be changed, hit
            the pencil icon and make an edit! Or if you are cool{' '}
            <a href="https://twitter.com/adamcogan">tweet me</a>
            <FontAwesomeIcon icon={faQuoteRight} />
          </blockquote>
          <div className="avatar">
            <img
              className="inline rounded-full"
              src="https://adamcogan.com/wp-content/uploads/2018/07/adam-bw.jpg"
              alt="Adam Cogan"
            />
          </div>
          <h5>
            <a
              href="https://www.ssw.com.au/people/adam-cogan"
              target="_blank"
              rel="noopener noreferrer"
            >
              Adam Cogan
            </a>
          </h5>
          <p>Chief Software Architect at SSW</p>
        </div>
      </section>
      <section>
        <Contact />
      </section>
      <section>
        <h4>About SSW</h4>
        <p>
          SSW Consulting has over 30 years of experience developing awesome
          Microsoft solutions that today build on top of Angular, React, Azure,
          Azure DevOps, SharePoint, Office 365, .NET Core, WebAPI, Dynamics 365,
          and SQL Server. With 40+ consultants in 5 countries, we have delivered
          the best in the business to more than 1,000 clients in 15 countries.
        </p>
      </section>
      <section>
        <h4>Join the conversation</h4>
        <div className="sidebar-spacing ">
          <a
            href="https://twitter.com/intent/tweet?button_hashtag=SSWRules&ref_src=twsrc%5Etfw"
            className="button twitter-hashtag-button"
            style={{ margin: 'auto' }}
          >
            <FontAwesomeIcon icon={faTwitter} />
            Tweet #SSWRules
          </a>
        </div>
      </section>
    </div>
  );
};

SideBar.propTypes = {
  ruleTotalNumber: PropTypes.number.isRequired,
  hideCount: PropTypes.bool,
};

export default SideBar;
