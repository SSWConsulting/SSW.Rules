import React from 'react';
import PropTypes from 'prop-types';
import Contact from '../contact/contact';
import NumberFormat from 'react-number-format';
import { faQuoteLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTwitter } from '@fortawesome/free-brands-svg-icons';

const SideBar = ({ ruleTotalNumber }) => {
  return (
    <div>
      <section className="rules-counter">
        <h2>
          <NumberFormat
            value={ruleTotalNumber}
            displayType={'text'}
            thousandSeparator={true}
          />
        </h2>
        <p>SSW Rules</p>
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
            rule that is out of date, please <a href="/email">email us</a>, or
            if you are cool{' '}
            <a href="/twitter">
              <FontAwesomeIcon icon={faTwitter} /> tweet me
            </a>
            .
          </blockquote>
        </div>
      </section>
      <section>
        <h4>Join the conversation</h4>
        <a
          href="https://twitter.com/intent/tweet?button_hashtag=SSWRules&ref_src=twsrc%5Etfw"
          className="button twitter-hashtag-button"
        >
          <FontAwesomeIcon icon={faTwitter} /> Tweet #SSWRules
        </a>
      </section>
      <section>
        <h4>About SSW</h4>
        <p>
          SSW Consulting has over 25 years of experience developing awesome
          Microsoft solutions that today build on top of AngularJS, Azure, TFS,
          SharePoint, .NET, Dynamics CRM and SQL Server. With 40+ consultants in
          5 countries, we have delivered the best in the business to more than
          1,000 clients in 15 countries.
        </p>
      </section>
      <section>
        <Contact />
      </section>
    </div>
  );
};

SideBar.propTypes = {
  ruleTotalNumber: PropTypes.number.isRequired,
};

export default SideBar;
