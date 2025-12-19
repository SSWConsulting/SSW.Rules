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
    <Popup isVisible={open} onClose={onClose} showCloseIcon className="w-full h-[90vh] overflow-auto">
      <div className="w-full h-[90vh] overflow-auto">
        <Jotform 
          src={`https://form.jotform.com/${jotFormId}`}
          className="w-full h-full border-0"
        />
      </div>
    </Popup>
  );
};

export default JobFormEmbed;
