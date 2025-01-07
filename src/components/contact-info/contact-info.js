import React from 'react';
import PropTypes from 'prop-types';

const ContactInfo = ({ onClick }) => {
  return (
    <div className="contact">
      <h3 className="text-ssw-red">
        Interested in what we can do for you?
      </h3>
      <p>Contact an Account Manager to discuss your project</p>
      <button className="btn btn-red" onClick={() => onClick()}>
        Book a Free Initial Meeting
      </button>
      <p>
        or call on{' '}
        <span className="font-semibold">
          <a href="tel:+61299533000">+61 2 9953 3000</a>
        </span>
      </p>
    </div>
  );
};

ContactInfo.propTypes = {
  onClick: PropTypes.func.isRequired,
};

export default ContactInfo;
