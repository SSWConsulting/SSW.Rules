import CMS from 'netlify-cms';
import PostPreview from './previewTemplate';

import styles from '!css-loader!../style.css';

CMS.registerPreviewStyle(styles.toString(), { raw: true });

CMS.registerPreviewTemplate('rule', PostPreview);
