import React from 'react';
//import Transition from '../components/transition/transition.js';
import PropTypes from 'prop-types';
import Layout from '../components/layout/layout';
import siteConfig from '../../site-config';

const wrapPageElement = ({ element, props }) => {
  const markdown =
    props && props.data && props.data.markdownRemark
      ? props.data.markdownRemark
      : null;

  const getTitleFromPath = (path) => {
    const titles = {
      '/': siteConfig.homepageTitle,
      '/orphaned/': 'Orphaned Rules',
      '/archived/': 'Archived Rules',
      '/profile/': 'Profile',
    };

    return titles[path] || siteConfig.breadcrumbDefault;
  };

  const pageTitle = markdown
    ? markdown.frontmatter.title
    : getTitleFromPath(props.path);

  return (
    //<Transition {...props}>
    <Layout
      {...props}
      crumbLocation={props.location}
      crumbLabel={pageTitle}
      seoDescription={markdown?.frontmatter?.seoDescription}
      displayActions={markdown ? true : false}
      ruleUri={markdown ? markdown.parent.relativePath : null}
    >
      {element}
    </Layout>
    // </Transition>
  );
};

wrapPageElement.propTypes = {
  element: PropTypes.any,
  props: PropTypes.any,
  data: PropTypes.any,
  location: PropTypes.any,
};

export default wrapPageElement;
