import Contact from '../contact/contact';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import GavelIcon from '-!svg-react-loader!../../images/gavel.svg';
import NumberFormat from 'react-number-format';
import PropTypes from 'prop-types';
import React from 'react';
import { Widget } from 'ssw.rules.widget';
import { faQuoteLeft } from '@fortawesome/free-solid-svg-icons';
import { faTwitter } from '@fortawesome/free-brands-svg-icons';

const SideBar = ({ ruleTotalNumber, location }) => {
  console.log(location);
  return (
    <div>
      <section className="rules-counter">
        <div className="flex grid grid-cols-6">
          <div className="col-span-1 col-start-2">
            <GavelIcon className="gavel-icon" />
          </div>
          <div className="col-span-2">
            <h2>
              <NumberFormat
                value={ruleTotalNumber}
                displayType={'text'}
                thousandSeparator={true}
              />
            </h2>
            <p>SSW Rules</p>
          </div>
        </div>
      </section>

      <section id="widget">
        <Widget token={process.env.GITHUB_API_PAT} location={location} />
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
        <h4>Help and improve our rules</h4>
        <div className="testimonial text-center rounded p-3">
          <div className="avatar">
            <img
              className="inline rounded-full"
              src="https://adamcogan.com/wp-content/uploads/2018/07/adam-bw.jpg"
              alt="Adam Cogan"
            />
          </div>
          <h5>Adam Cogan</h5>
          <h6>Chief Software Architect at SSW</h6>
          <blockquote>
            <FontAwesomeIcon icon={faQuoteLeft} /> Nothing great is easy. The
            SSW rules are a great resource for developers all around the world.
            However it’s hard to keep rules current and correct. If you spot a
            rule that is out of date, please{' '}
            <a href="https://www.ssw.com.au/ssw/Company/ContactUs.aspx">
              contact us
            </a>
            , or if you are cool{' '}
            <a href="https://twitter.com/adamcogan">
              <FontAwesomeIcon icon={faTwitter} /> tweet me
            </a>
            .
          </blockquote>
        </div>
      </section>
      <section>
        <Contact />
      </section>
      <section>
        <h4>About SSW</h4>
        <p>
          SSW Consulting has over 25 years of experience developing awesome
          Microsoft solutions that today build on top of Angular, React, Azure,
          Azure DevOps (was TFS), SharePoint, Office 365, .NET Core, WebAPI,
          Dynamics 365 and SQL Server. With 40+ consultants in 5 countries, we
          have delivered the best in the business to more than 1,000 clients in
          15 countries.
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
  location: PropTypes.object,
};

export default SideBar;
