import CMS from 'netlify-cms-app';
import PostPreview from './previewTemplate';
import styles from '!css-loader!../style.css';

CMS.init();

CMS.registerPreviewStyle(styles.toString(), { raw: true });
CMS.registerPreviewTemplate('rule', PostPreview);
