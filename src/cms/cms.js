import CMS from 'netlify-cms';
import PostPreview from './previewTemplate';

import '../style.css';

CMS.registerPreviewStyle('../styles.css');
CMS.registerPreviewTemplate('rule', PostPreview);
