import CMS from 'netlify-cms-app';
import PostPreview from './previewTemplate';
import styles from '!css-loader!../style.css';

CMS.init({
  config: {
    backend: {
      base_url: process.env.API_BASE_URL,
    },
  },
});

CMS.registerPreviewStyle(styles.toString(), { raw: true });
CMS.registerPreviewTemplate('rule', PostPreview);
