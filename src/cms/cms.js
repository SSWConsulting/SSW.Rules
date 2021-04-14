import CMS from 'netlify-cms';
import PostPreview from './previewTemplate';

CMS.registerPreviewStyle('../styles.css');
CMS.registerPreviewTemplate('rule', PostPreview);
