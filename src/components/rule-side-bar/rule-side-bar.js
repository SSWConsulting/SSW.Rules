import React from 'react';
import Acknowledgements from '../acknowledgements/acknowledgements';
import Categories from '../categories/categories';
import RelatedRules from '../related-rules/related-rules';
import PropTypes from 'prop-types';

const SidebarHeader = ({ header }) => {
  return (
    <div className="flex mt-4 text-center before:mr-5 after:ml-5 before:mb-7 after:mb-7 before:content-[''] before:flex-1 before:border-b before:border-solid after:flex-1 after:border-b after:border-solid">
      <h5 className="text-ssw-red text-xl ">{header}</h5>
    </div>
  );
};

const RuleSideBar = ({
  categories,
  location,
  rule,
  relatedRules,
  relatedRulesFromRedirects,
}) => {
  return (
    <div className="sticky top-0">
      <SidebarHeader header="Authors" />
      <Acknowledgements authors={rule.frontmatter.authors} />

      <SidebarHeader header="Categories" />
      <Categories categories={categories} location={location} rule={rule} />

      <SidebarHeader header="Related Rules" />
      <RelatedRules
        rule={rule}
        relatedRules={relatedRules}
        relatedRulesFromRedirects={relatedRulesFromRedirects}
      />
    </div>
  );
};

SidebarHeader.propTypes = {
  header: PropTypes.string,
};

export default RuleSideBar;
