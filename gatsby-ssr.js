/* eslint-disable react/react-in-jsx-scope */
import * as React from 'react';
import wrapPageElementWithTransition from './src/helpers/wrapPageElement.js';
import '@fontsource-variable/inter';
import interWoff2 from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';

export const onRenderBody = ({ setHeadComponents }) => {
  setHeadComponents([
    <link
      rel="preload"
      as="font"
      type="font/woff2"
      href={interWoff2}
      crossOrigin="anonymous"
      key="interPreload"
    />,
  ]);
};

// Page Transitions
export const wrapPageElement = wrapPageElementWithTransition;
