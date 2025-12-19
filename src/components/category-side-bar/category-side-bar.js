import React, { useState } from 'react';
import PropTypes from 'prop-types';
import JotFormEmbed from '../job-form-embed/jobFormEmbed';

const Contact = () => {
  const [displayContactForm, setDisplayContactForm] = useState(false);

  const onContactButtonClick = () => {
    setDisplayContactForm(!displayContactForm);
  };
  return (
    <div className="flex items-center justify-center">
      <button
        className="btn btn-red text-sm normal-case"
        onClick={() => onContactButtonClick()}
      >
        Book a FREE Initial Meeting
      </button>
      <JotFormEmbed
        jotFormId="233468468973070"
        open={displayContactForm}
        onClose={onContactButtonClick}
      />
    </div>
  );
};

const SidebarHeader = ({ sectionTitle }) => {
  return (
    <div className="flex pt-9 mb-4 text-center before:mr-5 after:ml-5 before:mb-3 after:mb-3 before:content-[''] before:flex-1 before:border-b before:border-solid after:flex-1 after:border-b after:border-solid">
      <div className="flex items-center [&>button]:h-6 pl-1">
        <button className="flex h-10 items-center justify-center">
          <h5 className="text-ssw-red text-xl">{sectionTitle}</h5>
        </button>
      </div>
    </div>
  );
};

export const CategorySideBar = () => {
  return (
    <div className="sticky top-0 xl:mb-20">
      <SidebarHeader sectionTitle="Need Help?" />
      <Contact />
    </div>
  );
};

SidebarHeader.propTypes = {
  sectionTitle: PropTypes.string,
};

export default CategorySideBar;
