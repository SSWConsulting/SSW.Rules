'use client';

import React, { useState } from 'react';
import { RiOpenaiFill } from 'react-icons/ri';
import { IconLink } from './ui';

const ChatGPTSummaryButton = () => {
  const [uri] = useState<string>(() => {
    const prompt = `Read ${window.location.href}. You are to assist the user with their queries about this rule - and if they have follow up questions, make sure you always reference this content`;
    return `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`;
  });

  return (
    <IconLink href={uri || ''}
      title='Summarise in ChatGPT'
      tooltipOpaque={true}
      target='_blank'>
      <RiOpenaiFill />
    </IconLink>
  );
};

export default ChatGPTSummaryButton;
