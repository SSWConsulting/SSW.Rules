import React from 'react';
import PropTypes from 'prop-types';
import Jotform from 'react-jotform';
import Popup from '../popup/popup';

const JobFormEmbed = ({ jotFormId, open, onClose }) => {
  if (!jotFormId) return <></>;

  return (
    <>
      <Popup isVisible={open} showCloseIcon={true} onClose={onClose}>
        <Jotform src={`https://form.jotform.com/${jotFormId}`}></Jotform>
      </Popup>
    </>
  );
};

export default JobFormEmbed;

JobFormEmbed.propTypes = {
  jotFormId: PropTypes.string,
  open: PropTypes.bool,
  onClose: PropTypes.func,
};
