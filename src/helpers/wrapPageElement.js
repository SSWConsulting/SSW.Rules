import React from 'react';
//import Transition from '../components/transition/transition.js';
import PropTypes from 'prop-types';
import Layout from '../components/layout/layout';

const wrapPageElement = ({ element, props }) => {
  const markdown = null;
  // props && props.data && props.data.markdownRemark
  //   ? props.data.markdownRemark
  //   : null;

  const pageTitle = markdown ? markdown.frontmatter.title : '';

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
