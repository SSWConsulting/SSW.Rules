window.CMS_MANUAL_INIT = true;

import CMS, { init } from 'netlify-cms-app';
import PostPreview from './previewTemplate';
import styles from '!css-loader!../style.css';
import configJson from './config.js';

init(configJson);

CMS.registerPreviewStyle(styles.toString(), { raw: true });
CMS.registerPreviewTemplate('rule', PostPreview);
