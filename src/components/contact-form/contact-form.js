import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import ReCAPTCHA from 'react-google-recaptcha';

const ReferralSource = {
  Conference: 8,
  Google: 1,
  ['Government Suppliers List']: 20,
  ['Outbound Call']: 15,
  ['Repeat Business']: 4,
  ['.NET User Group']: 3,
  ['SSW Training Event']: 2,
  Referral: 12,
  Signage: 7,
  ['Yellow Pages']: 9,
  ['SSW TV']: 17,
  Webinars: 16,
  ['Other search engines']: 10,
  Other: 14,
};

const ReferralSourceList = Object.keys(ReferralSource).map((key) => {
  return {
    label: key,
    value: ReferralSource[key],
  };
});

const ContactForm = ({ onClose }) => {
  const node = useRef();
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactFormName, setContactFormName] = useState('');
  const [contactFormEmail, setContactFormEmail] = useState('');
  const [contactFormPhone, setContactFormPhone] = useState('');
  const [contactFormCompanyName, setContactFormCompanyName] = useState('');
  const [contactFormNote, setContactFormNote] = useState('');
  const [contactFormCountry, setContactFormCountry] = useState('');
  const [contactFormState, setContactFormState] = useState('100000008');
  const [contactFormStateText, setContactFormStateText] = useState('');
  const [contactReCaptcha, setContactReCaptcha] = useState('');
  const [referralSource, setReferralSource] = useState('');

  const handleSubmit = async (event) => {
    let subject =
      'Consulting enquiry - ' +
      contactFormCompanyName +
      ' - ' +
      contactFormName;

    let sourceWebPageURL;
    if (typeof window !== 'undefined') {
      sourceWebPageURL = window.location.href;
    } else {
      sourceWebPageURL = '';
    }

    let body = 'Consulting enquiry from ' + document.URL + '<br/>';
    body = body + 'Company: ' + contactFormCompanyName + '<br/>';
    body = body + 'Country: ' + contactFormCountry + '<br/>';
    if (contactFormStateText == '') {
      setContactFormState('100000008');
    } else {
      body = body + 'State:  ' + contactFormStateText + '<br/>';
    }
    body = body + 'Name:  ' + contactFormName + '<br/>';
    body = body + 'Phone:   ' + contactFormPhone + '<br/>';
    body = body + 'Email:   ' + contactFormEmail + '<br/>';
    body = body + 'Note:    ' + contactFormNote + '<br/><br/>';
    event.preventDefault();

    // Documentation - Create Lead - https://sswcom.sharepoint.com/:w:/r/sites/SSWDevelopers/_layouts/15/Doc.aspx?sourcedoc=%7BE8A18D9B-DE74-47EC-B836-01A5AD193DCC%7D&file=Create-lead-Flow.docx&action=default&mobileredirect=true
    if (process.env.CONTACT_API !== 'FALSE') {
      await axios
        .post(
          process.env.CONTACT_API,
          {
            Name: contactFormName,
            Topic: subject,
            Company: contactFormCompanyName,
            Note: contactFormNote,
            Country: contactFormCountry,
            State: contactFormState,
            Email: contactFormEmail,
            Phone: contactFormPhone,
            Recaptcha: contactReCaptcha,
            EmailSubject: subject,
            EmailBody: body + 'The associated CRM lead is ',
            ReferralSource: referralSource,
            SourceWebPageURL: sourceWebPageURL,
          },
          { headers: { 'Content-Type': 'application/json' } }
        )
        .then(() => {
          setContactSuccess(true);
          setTimeout(function () {
            setContactSuccess(false);
            //redirect to thank you page
            window.location = '/ssw/Thankyou.aspx';
          }, 2000);
        })
        .catch(() => {
          alert('Failed to create lead in CRM');
        });
    }
  };

  const handleClick = (e) => {
    if (node.current.contains(e.target)) {
      // inside click
      return;
    }
    // outside click
    onClose(e);
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClick);

    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, []);

  return (
    <form
      ref={node}
      className="contactUs-form w-full lg:w-1/2 object-center"
      onSubmit={(e) => handleSubmit(e)}
    >
      <div className="contactUs">
        <h2>Get your project started!</h2>
        <div
          className={contactSuccess ? 'form-group fadeIn' : 'fadeOut'}
          id="contactFormAlert"
        >
          <div className="alert alert-success" role="alert">
            An email has been sent to the SSW Sales team and someone will be in
            contact with you soon
          </div>
        </div>
        <div className="form-group">
          <div className="field-wrapper">
            <label htmlFor="contactFormName" className="control-label">
              Full Name *
            </label>
            <input
              id="contactFormName"
              type="text"
              value={contactFormName}
              onChange={(e) => setContactFormName(e.target.value)}
              className="form-control ng-untouched"
              required
              placeholder="Full Name *"
            />
          </div>
        </div>

        <div className="form-group">
          <div className="field-wrapper">
            <label htmlFor="contactFormEmail" className="control-label">
              Email *
            </label>
            <input
              id="contactFormEmail"
              value={contactFormEmail}
              onChange={(e) => setContactFormEmail(e.target.value)}
              type="email"
              className="form-control ng-untouched"
              required
              placeholder="Email *"
            />
          </div>
        </div>

        <div className="form-group">
          <div className="field-wrapper">
            <label htmlFor="contactFormPhone" className="control-label">
              Phone
            </label>
            <input
              id="contactFormPhone"
              value={contactFormPhone}
              onChange={(e) => setContactFormPhone(e.target.value)}
              type="text"
              className="form-control"
              placeholder="Phone"
            />
          </div>
        </div>

        <div className="form-group">
          <div className="field-wrapper list">
            <label htmlFor="contactFormCountry" className="control-label">
              Location
            </label>
            {/* eslint-disable-next-line jsx-a11y/no-onchange */}
            <select
              id="contactFormCountry"
              className="form-control"
              value={contactFormCountry}
              onChange={(e) => setContactFormCountry(e.target.value)}
            >
              <option value="" disabled="" hidden="">
                Location
              </option>
              <option value="Australia">Australia</option>
              <option value="China">China</option>
              <option value="Europe">Europe</option>
              <option value="SouthAmerica">South America</option>
              <option value="USA">USA</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {contactFormCountry === 'Australia' && (
          <div className="form-group ng-hide" id="contactFormState">
            <div className="field-wrapper list">
              <label htmlFor="contactFormState" className="control-label">
                State - {contactFormState} {contactFormStateText}
              </label>
              {/* eslint-disable-next-line jsx-a11y/no-onchange */}
              <select
                id="contactFormState"
                className="form-control"
                value={contactFormState}
                onChange={() => {
                  setContactFormState(event.target.value);
                  let index = event.target.selectedIndex;
                  setContactFormStateText(event.target[index].text);
                }}
              >
                <option value="" disabled="" hidden="">
                  State
                </option>
                <option value="100000000">NSW</option>
                <option value="100000001">VIC</option>
                <option value="100000002">QLD</option>
                <option value="100000003">ACT</option>
                <option value="100000004">SA</option>
                <option value="100000005">WA</option>
                <option value="100000006">NT</option>
                <option value="100000007">TAS</option>
                <option value="100000008">Other</option>
              </select>
            </div>
          </div>
        )}

        <div className="form-group">
          <div className="field-wrapper">
            <label htmlFor="contactFormCompanyName" className="control-label">
              Company
            </label>
            <input
              id="contactFormCompanyName"
              value={contactFormCompanyName}
              onChange={(e) => setContactFormCompanyName(e.target.value)}
              type="text"
              className="form-control"
              placeholder="Company"
            />
          </div>
        </div>

        <div className="form-group">
          <div className="field-wrapper list">
            <label htmlFor="contactFormCountry" className="control-label">
              How did you hear about us?
            </label>
            <select
              id="contactFormCountry"
              className="form-control"
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value)}
            >
              <option className="hidden" value="">
                How did you hear about us?
              </option>
              {ReferralSourceList.map((source) => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <div className="field-wrapper">
            <label htmlFor="contactFormNote" className="control-label">
              Message
            </label>
            <textarea
              id="contactFormNote"
              value={contactFormNote}
              onChange={(e) => setContactFormNote(e.target.value)}
              className="form-control"
              placeholder="Note"
              rows="4"
              maxLength="2000"
            ></textarea>
          </div>
          <small>Maximium 2000 characters.</small>
        </div>
        <div className="form-group recaptcha">
          {process.env.RECAPTCHA_KEY !== 'FALSE' && (
            <ReCAPTCHA
              sitekey={process.env.RECAPTCHA_KEY}
              onChange={(value) => setContactReCaptcha(value)}
            />
          )}
        </div>
        <div className="form-group">
          <button id="contactFormSubmit" className="btn btn-red submit">
            Submit
          </button>
          &nbsp;
          <button id="contactFormClose" className="btn close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </form>
  );
};

ContactForm.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default ContactForm;
