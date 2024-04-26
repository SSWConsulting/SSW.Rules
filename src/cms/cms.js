window.CMS_MANUAL_INIT = true;

import React from 'react';
import CMS from 'decap-cms-app';
import PostPreview from './previewTemplate';
import styles from '!css-loader!../style.css';
import configJson from './config.js';

const tipsControl = () => {
  return (
    <div>
      <a
        target="_blank"
        href="https://github.com/SSWConsulting/SSW.Rules.Content/wiki/Netlify-CMS-%F0%9F%90%9B----Failed-to-save"
        rel="noreferrer"
        style={{ textDecoration: 'underline' }}
      >
        HOW TO FIX API ERROR 502
      </a>
    </div>
  );
};

CMS.registerWidget('tips', tipsControl);

CMS.init(configJson);

CMS.registerPreviewStyle(styles.toString(), { raw: true });
CMS.registerPreviewTemplate('rule', PostPreview);
