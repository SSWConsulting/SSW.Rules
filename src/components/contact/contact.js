import React, { useState } from 'react';
import ContactInfo from '../contact-info/contact-info';
import JotFormEmbed from '../job-form-embed/jobFormEmbed';

const Contact = () => {
  const [displayContactForm, setDisplayContactForm] = useState(false);

  const onContactButtonClick = () => {
    setDisplayContactForm(!displayContactForm);
  };
  return (
    <>
      <ContactInfo onClick={() => onContactButtonClick()} />
      <JotFormEmbed
        jotFormId="233468468973070"
        open={displayContactForm}
        onClose={onContactButtonClick}
      />
    </>
  );
};

export default Contact;
