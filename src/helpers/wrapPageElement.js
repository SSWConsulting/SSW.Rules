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

  return (
    //<Transition {...props}>
    <Layout
      {...props}
      crumbLocation={props.location}
      crumbLabel={
        markdown ? markdown.frontmatter.title : siteConfig.breadcrumbDefault
      }
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
