import React, { useState } from 'react';
import ContactInfo from '../contact-info/contact-info';
import ContactForm from '../contact-form/contact-form';
import Modal from 'react-modal';

const Contact = () => {
  const [displayContactForm, setDisplayContactForm] = useState(false);

  const onContactButtonClick = () => {
    setDisplayContactForm(!displayContactForm);
  };
  return (
    <>
      <ContactInfo onClick={() => onContactButtonClick()} />
      <Modal
        isOpen={displayContactForm}
        contentLabel="Contact Form"
        className="modal"
      >
        <ContactForm onClose={() => setDisplayContactForm(false)} />
      </Modal>
    </>
  );
};

export default Contact;
