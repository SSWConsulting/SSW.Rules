// import { config } from '@fortawesome/fontawesome-svg-core';
// import { faGithub } from '@fortawesome/free-brands-svg-icons';
// import {
//   faArrowCircleRight,
//   faBook,
//   faExclamationTriangle,
//   faFileLines,
//   faPencilAlt,
//   faQuoteLeft,
// } from '@fortawesome/free-solid-svg-icons';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { ApplicationInsights } from '@microsoft/applicationinsights-web';
// import { graphql, Link, useStaticQuery } from 'gatsby';
// import PropTypes from 'prop-types';
// import React, { useEffect, useRef, useState } from 'react';
// import { pathPrefix } from '../../site-config';
// import Bookmark from '../components/bookmark/bookmark';
// import Breadcrumb from '../components/breadcrumb/breadcrumb';
// import RadioButton from '../components/radio-button/radio-button';
// import Tooltip from '../components/tooltip/tooltip';

// config.autoAddCss = false;

// const appInsights = new ApplicationInsights({
//   config: {
//     instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
//   },
// });

// appInsights.loadAppInsights();

// const Orphaned = ({ data }) => {
//   const linkRef = useRef();

//   const [selectedOption, setSelectedOption] = useState('all');
//   const [showViewButton, setShowViewButton] = useState(false);

//   useEffect(() => {
//     setShowViewButton(true);
//   }, []);

//   const handleOptionChange = (e) => {
//     setSelectedOption(e.target.value);
//   };

//   /**
//    * Get all rules that don't have an associated category
//    * @param {Object} rules All rule nodes
//    * @param {Object} categories All category nodes
//    * @return {array} All rules without an associated category
//    */
//   const findOrphanedRules = (rules, categories) => {
//     const orphanedRules = [];

//     rules.nodes.forEach((node) => {
//       // Find any rules missing a category
//       var match = false;
//       if (!node.frontmatter.archivedreason) {
//         categories.nodes.forEach((catNode) => {
//           catNode.frontmatter.index.forEach((inCat) => {
//             if (node.frontmatter.uri == inCat) {
//               match = true;
//             }
//           });
//         });
//       } else {
//         match = true;
//       }
//       if (match == false) {
//         orphanedRules.push(node);
//       }
//     });

//     return orphanedRules;
//   };

//   const category = data.categories.nodes[0];
//   const rules = findOrphanedRules(data.rules, data.categories);

//   return (
//     <div>
//       <Breadcrumb categoryTitle="Orphaned" isCategory={true} />
//       <div className="w-full">
//         <div className="rule-category rounded">
//           <section className="mb-20 rounded pb-2">
//             <div className="cat-title-grid-container">
//               <h1 className="text-ssw-black font-medium text-3xl">
//                 Orphaned Rules
//                 <span className="rule-count">
//                   {' - '} {rules.length} {rules.length > 1 ? 'Rules' : 'Rule'}
//                 </span>
//               </h1>

//               <Tooltip text="Edit in GitHub">
//                 <a
//                   target="_blank"
//                   rel="noopener noreferrer"
//                   href={`https://github.com/SSWConsulting/SSW.Rules.Content/tree/${process.env.CONTENT_BRANCH}/${category.parent.relativePath}`}
//                 >
//                   <FontAwesomeIcon
//                     icon={faGithub}
//                     size="2x"
//                     className="category-icon bookmark-icon"
//                   />
//                 </a>
//               </Tooltip>
//             </div>

//             <div className="rule-category-top py-4 px-6 pt-5">
//               <div>
//                 <br />
//                 <div className="attention archived px-4">
//                   <FontAwesomeIcon
//                     icon={faExclamationTriangle}
//                     className="attentionIcon"
//                   />{' '}
//                   The rules listed below have no parent category
//                 </div>
//               </div>
//             </div>
//             {showViewButton && (
//               <div className="border-b border-solid border-b-gray-100 grid grid-cols-1 gap-5 p-4 text-center lg:grid-cols-5">
//                 <div></div>
//                 <RadioButton
//                   id="customRadioInline1"
//                   name="customRadioInline1"
//                   value="titleOnly"
//                   selectedOption={selectedOption}
//                   handleOptionChange={handleOptionChange}
//                   labelText="View titles only"
//                   icon={faQuoteLeft}
//                 />
//                 <RadioButton
//                   id="customRadioInline3"
//                   name="customRadioInline1"
//                   value="blurb"
//                   selectedOption={selectedOption}
//                   handleOptionChange={handleOptionChange}
//                   labelText="Show blurb"
//                   icon={faFileLines}
//                 />
//                 <RadioButton
//                   id="customRadioInline2"
//                   name="customRadioInline1"
//                   value="all"
//                   selectedOption={selectedOption}
//                   handleOptionChange={handleOptionChange}
//                   labelText="Gimme everything!"
//                   icon={faBook}
//                 />
//               </div>
//             )}
//             <div className="category-rule">
//               <ol className="rule-number">
//                 {rules.map((rule, i) => {
//                   if (!rule) {
//                     return;
//                   }
//                   return (
//                     <div key={i}>
//                       <li key={i}>
//                         <section className="rule-content-title pl-2">
//                           <div className="rule-header-container justify-between align-middle">
//                             <h2 className="flex flex-col justify-center">
//                               <Link
//                                 ref={linkRef}
//                                 to={`/${rule.frontmatter.uri}`}
//                               >
//                                 {rule.frontmatter.title}
//                               </Link>
//                             </h2>
//                             <div className="rule-buttons category flex flex-col sm:flex-row">
//                               <Bookmark
//                                 ruleId={rule.frontmatter.guid}
//                                 className="category-bookmark"
//                               />
//                               <button className="tooltip">
//                                 <a
//                                   target="_blank"
//                                   rel="noopener noreferrer"
//                                   href={`${pathPrefix}/admin/#/collections/rule/entries/${rule.frontmatter.uri}/rule`}
//                                   className="tooltip tooltip-button"
//                                   onClick={() => {
//                                     appInsights.trackEvent({
//                                       name: 'EditMode-NetlifyCMS',
//                                     });
//                                   }}
//                                 >
//                                   <FontAwesomeIcon
//                                     icon={faPencilAlt}
//                                     size="lg"
//                                     className="bookmark-icon"
//                                   />
//                                 </a>
//                                 <span className="tooltiptext w-52 !-left-[4.6rem]">
//                                   Edit
//                                   <p>
//                                     (Warning: Stale branches can cause issues -
//                                     See wiki for help)
//                                   </p>
//                                 </span>
//                               </button>
//                               <button className="tooltip">
//                                 <a
//                                   target="_blank"
//                                   rel="noopener noreferrer"
//                                   href={`https://github.com/SSWConsulting/SSW.Rules.Content/tree/${process.env.CONTENT_BRANCH}/rules/${rule.frontmatter.uri}/rule.md`}
//                                   className="tooltip tooltip-button"
//                                   onClick={() => {
//                                     appInsights.trackEvent({
//                                       name: 'EditMode-GitHub',
//                                     });
//                                   }}
//                                 >
//                                   <FontAwesomeIcon
//                                     icon={faGithub}
//                                     size="lg"
//                                     className="bookmark-icon"
//                                   />
//                                 </a>
//                                 <span className="tooltiptext">
//                                   Edit in GitHub
//                                 </span>
//                               </button>
//                             </div>
//                           </div>
//                         </section>

//                         <section
//                           className={`rule-content mb-4
//                             ${selectedOption === 'all' ? 'visible' : 'hidden'}`}
//                         >
//                           <div
//                             dangerouslySetInnerHTML={{ __html: rule.html }}
//                           />
//                         </section>

//                         <section
//                           className={`rule-content mb-4
//                           ${selectedOption === 'blurb' ? 'visible' : 'hidden'}`}
//                         >
//                           <div
//                             dangerouslySetInnerHTML={{ __html: rule.excerpt }}
//                           />
//                           <p className="pt-5 pb-0 font-bold">
//                             <Link
//                               ref={linkRef}
//                               to={`/${rule.frontmatter.uri}`}
//                               title={`Read more about ${rule.frontmatter.title}`}
//                             >
//                               <FontAwesomeIcon icon={faArrowCircleRight} /> Read
//                               more
//                             </Link>
//                           </p>
//                         </section>
//                       </li>
//                     </div>
//                   );
//                 })}
//               </ol>
//             </div>
//           </section>
//         </div>
//       </div>
//     </div>
//   );
// };
// Orphaned.propTypes = {
//   data: PropTypes.object.isRequired,
//   pageContext: PropTypes.object.isRequired,
//   location: PropTypes.object.isRequired,
// };

// function OrphanedWithQuery(props) {
//   const data = useStaticQuery(graphql`
//     query OrphanedQuery {
//       main: allMdx(
//         filter: {
//           fileAbsolutePath: { regex: "/(categories)/" }
//           frontmatter: { type: { eq: "main" } }
//         }
//       ) {
//         nodes {
//           frontmatter {
//             type
//             title
//             index
//           }
//           parent {
//             ... on File {
//               name
//             }
//           }
//         }
//       }
//       topCategories: allMdx(
//         filter: {
//           fileAbsolutePath: { regex: "/(categories)/" }
//           frontmatter: { type: { eq: "top-category" } }
//         }
//       ) {
//         nodes {
//           frontmatter {
//             type
//             title
//             index
//           }
//           parent {
//             ... on File {
//               name
//               relativeDirectory
//             }
//           }
//         }
//       }
//       categories: allMdx(
//         filter: {
//           fileAbsolutePath: { regex: "/(categories)/" }
//           frontmatter: { type: { eq: "category" } }
//         }
//       ) {
//         nodes {
//           frontmatter {
//             type
//             title
//             archivedreason
//             index
//           }
//           parent {
//             ... on File {
//               name
//               relativeDirectory
//             }
//           }
//         }
//       }
//       rules: allMdx(filter: { frontmatter: { type: { eq: "rule" } } }) {
//         nodes {
//           frontmatter {
//             uri
//             archivedreason
//             title
//           }
//           excerpt(format: HTML, pruneLength: 500)
//         }
//       }
//     }
//   `);

//   return <Orphaned data={data} {...props} />;
// }

// export default OrphanedWithQuery;
