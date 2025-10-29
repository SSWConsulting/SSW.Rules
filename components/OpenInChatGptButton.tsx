'use client';

import React, { useEffect, useState } from 'react';
import { RiOpenaiFill } from 'react-icons/ri';
import { IconLink } from './ui';

const ChatGPTSummaryButton = () => {
  const [uri, setUri] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      const prompt = `Read ${currentUrl}. You are to assist the user with their queries about this rule - and if they have follow up questions, make sure you always reference this content`;
      const chatGptUrl = `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`;
      setUri(chatGptUrl);
    }
  }, []);

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
