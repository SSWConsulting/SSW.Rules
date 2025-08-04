'use client';

import React from 'react';
import Jotform from 'react-jotform';
import Popup from './Popup';

interface JobFormEmbedProps {
  jotFormId: string;
  open: boolean;
  onClose: () => void;
}

const JobFormEmbed: React.FC<JobFormEmbedProps> = ({ jotFormId, open, onClose }) => {
  if (!jotFormId) return null;

  return (
    <Popup isVisible={open} onClose={onClose} showCloseIcon>
      <Jotform src={`https://form.jotform.com/${jotFormId}`}></Jotform>
    </Popup>
  );
};

export default JobFormEmbed;
