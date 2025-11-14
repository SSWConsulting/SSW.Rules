'use client';

import React, { useEffect, useState } from 'react';
import { RiOpenaiFill } from 'react-icons/ri';
import Link from 'next/link';

const ChatGPTSummaryButton = () => {
  const [uri, setUri] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      const prompt = `Read ${currentUrl}
You are to assist the user with their queries about this rule - and if they have follow up questions, make sure you always reference this content`;
      const chatGptUrl = `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`;
      setUri(chatGptUrl);
    }
  }, []);

  return (
    <Link href={uri} target='_blank'
      className='flex items-center px-2 py-1 border rounded-md hover:bg-ssw-red hover:text-white'>
      <RiOpenaiFill />
      <span className='ml-1 text-sm font-semibold'>Open in ChatGPT</span>
    </Link>
  );
};

export default ChatGPTSummaryButton;
