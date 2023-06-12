import React from 'react';
import Acknowledgements from '../acknowledgements/acknowledgements';
import Categories from '../sidebar-categories/sidebar-categories';
import RelatedRules from '../related-rules/related-rules';
import PropTypes from 'prop-types';
import Tooltip from '../tooltip/tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const tooltipData = {
  Authors: {
    text: 'How to add an Author',
    link: 'https://github.com/SSWConsulting/SSW.Rules.Content/wiki/Editing-rules',
  },
  Categories: {
    text: 'How to add a category',
    link: 'https://github.com/SSWConsulting/SSW.Rules.Content/wiki/Creating-Editing-categories',
  },
};

const SidebarHeader = ({ sectionTitle }) => {
  const tooltip = tooltipData[sectionTitle];

  return (
    <div className="flex mt-4 text-center before:mr-5 after:ml-5 before:mb-7 after:mb-7 before:content-[''] before:flex-1 before:border-b before:border-solid after:flex-1 after:border-b after:border-solid">
      <h5 className="text-ssw-red text-xl ">{sectionTitle}</h5>

      {tooltip && (
        <div className="flex items-center [&>button]:h-6 pl-1">
          <Tooltip text={tooltip.text}>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={tooltip.link}
              className="hover:scale-110 pt-0.5"
            >
              <FontAwesomeIcon icon={faInfoCircle} size="sm" />
            </a>
          </Tooltip>
        </div>
      )}
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
    <div className="sticky top-0 overflow-y-scroll hide-scrollbar">
      <SidebarHeader sectionTitle="Authors" />
      <Acknowledgements authors={rule.frontmatter.authors} />

      <SidebarHeader sectionTitle="Categories" />
      <Categories categories={categories} location={location} rule={rule} />

      <SidebarHeader sectionTitle="Related Rules" />
      <RelatedRules
        rule={rule}
        relatedRules={relatedRules}
        relatedRulesFromRedirects={relatedRulesFromRedirects}
      />
    </div>
  );
};

SidebarHeader.propTypes = {
  sectionTitle: PropTypes.string,
};

RuleSideBar.propTypes = {
  sectionTitle: PropTypes.string,
  categories: PropTypes.array,
  rule: PropTypes.object,
  location: PropTypes.object,
  relatedRules: PropTypes.object,
  relatedRulesFromRedirects: PropTypes.object,
};

export default RuleSideBar;
