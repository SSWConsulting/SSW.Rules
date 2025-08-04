import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import JobFormEmbed from './JobFormEmbed';

const HelpCard: React.FC = () => {
  const [open, setOpen] = useState(false);

  const handleOpenForm = () => {
    setOpen(true);
  };

  return (
    <Card title="Need help?">
      <p className="text-gray-700 mb-6">
        SSW Consulting has over 30 years of experience developing awesome software solutions.
      </p>
      <button
        onClick={() => handleOpenForm()}
        className="w-full bg-ssw-red text-white py-3 px-4 rounded hover:bg-ssw-red/90 transition hover:cursor-pointer"
      >
        Book a free initial meeting
      </button>
      <JobFormEmbed
        jotFormId="233468468973070" 
        open={open}
        onClose={() => setOpen(false)}
      />
    </Card>
  );
};

export default HelpCard;
