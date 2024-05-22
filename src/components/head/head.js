import React from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import { useStaticQuery, graphql } from 'gatsby';
import { Location } from '@reach/router';
import schemaGenerator from '../../helpers/schemaGenerator';
import { pathPrefix, homepageTitle } from '../../../site-config';

const Head = ({
  siteTitle,
  siteDescription,
  siteUrl,
  parentSiteUrl,
  pageTitle,
  seoDescription,
  themeColor,
  social,
  imageUrl,
  location,
}) => {
  const generateTitle = (path, pageTitle) => {
    const titles = {
      '/latest-rules/': 'Latest Rules',
      '/user/': 'User Rules',
      '/orphaned/': 'Orphaned Rules',
      '/archived/': 'Archived Rules',
      '/profile/': 'Profile',
    };

    if (pageTitle) {
      return `${pageTitle} | ${siteTitle}`;
    }

    const titleFromPath = titles[path];
    if (titleFromPath) {
      return `${titleFromPath} | ${siteTitle}`;
    }

    return `${siteTitle} | ${homepageTitle}`;
  };

  const fullTitle = generateTitle(location.pathname, pageTitle);

  const canonical = parentSiteUrl + (location.pathname || '');

  return (
    <Helmet>
      <html lang="en" />

      <meta content="IE=edge" httpEquiv="X-UA-Compatible" />
      <meta
        content="width=device-width,initial-scale=1.0,user-scalable=yes"
        name="viewport"
      />

      <meta content={siteTitle} name="apple-mobile-web-app-title" />
      <meta content={fullTitle} property="og:title" />
      <meta content={fullTitle} name="twitter:title" />
      <title>{fullTitle}</title>

      <meta content={seoDescription || siteDescription} name="description" />
      <meta
        content={seoDescription || siteDescription}
        property="og:description"
      />
      <meta
        content={seoDescription || siteDescription}
        name="twitter:description"
      />

      <meta content="yes" name="apple-mobile-web-app-capable" />
      <meta
        content="black-translucent"
        name="apple-mobile-web-app-status-bar-style"
      />
      <meta content={themeColor} name="theme-color" />
      <meta content={siteTitle} name="application-name" />

      <meta content="website" property="og:type" />
      <meta content={siteTitle} property="og:site_name" />
      <meta content={social.fbAppId} property="fb:app_id" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content={`@${social.twitter}`} name="twitter:site" />
      <meta content={`@${social.twitter}`} name="twitter:creator" />
      <meta content={fullTitle} name="twitter:text:title" />
      <meta content={canonical} property="og:url" />
      <meta content={canonical} name="twitter:url" />
      <link rel="canonical" href={canonical} />

      <meta
        content={
          imageUrl || `${siteUrl}/assets/Open-Graph-images-Website-Rules.jpg`
        }
        property="og:image"
      />
      <meta content="1024" property="og:image:width" />
      <meta content="512" property="og:image:height" />
      <meta
        content={
          imageUrl || `${siteUrl}/assets/Open-Graph-images-Website-Rules.jpg`
        }
        name="twitter:image"
      />
      <meta content="1024" name="twitter:image:width" />
      <meta content="512" name="twitter:image:height" />
      <meta
        content={
          imageUrl || `${siteUrl}/assets/Open-Graph-images-Website-Rules.jpg`
        }
        property="og:image"
      />
      <meta content="1024" property="og:image:width" />
      <meta content="512" property="og:image:height" />

      <meta content={themeColor} name="msapplication-TileColor" />
      <meta
        content="/ssw/include/pigeon/img/mstile-70x70.png"
        name="msapplication-square70x70"
      />
      <meta
        content="/ssw/include/pigeon/img/mstile-144x144.png"
        name="msapplication-square144x144"
      />
      <meta
        content="/ssw/include/pigeon/img/mstile-150x150.png"
        name="msapplication-square150x150"
      />
      <meta
        content="/ssw/include/pigeon/img/mstile-310x150.png"
        name="msapplication-wide310x150"
      />
      <meta
        content="/ssw/include/pigeon/img/mstile-310x310.png"
        name="msapplication-square310x310"
      />

      <link href={`${pathPrefix}/manifest.json`} rel="manifest" />

      <link
        href="/ssw/include/pigeon/img/apple-touch-icon-57x57.png"
        rel="apple-touch-icon"
        sizes="57x57"
      />
      <link
        href="/ssw/include/pigeon/img/apple-touch-icon-60x60.png"
        rel="apple-touch-icon"
        sizes="60x60"
      />
      <link
        href="/ssw/include/pigeon/img/apple-touch-icon-72x72.png"
        rel="apple-touch-icon"
        sizes="72x72"
      />
      <link
        href="/ssw/include/pigeon/img/apple-touch-icon-76x76.png"
        rel="apple-touch-icon"
        sizes="76x76"
      />
      <link
        href="/ssw/include/pigeon/img/apple-touch-icon-114x114.png"
        rel="apple-touch-icon"
        sizes="114x114"
      />
      <link
        href="/ssw/include/pigeon/img/apple-touch-icon-120x120.png"
        rel="apple-touch-icon"
        sizes="120x120"
      />
      <link
        href="/ssw/include/pigeon/img/apple-touch-icon-144x144.png"
        rel="apple-touch-icon"
        sizes="144x144"
      />
      <link
        href="/ssw/include/pigeon/img/apple-touch-icon-152x152.png"
        rel="apple-touch-icon"
        sizes="152x152"
      />
      <link
        href="/ssw/include/pigeon/img/apple-touch-icon-180x180.png"
        rel="icon"
        sizes="180x180"
        type="image/png"
      />

      <link
        href="/ssw/include/pigeon/img/favicon-32x32.png"
        rel="icon"
        sizes="32x32"
        type="image/png"
      />
      <link
        href="/ssw/include/pigeon/img/favicon-16x16.png"
        rel="icon"
        sizes="16x16"
        type="image/png"
      />

      <script type="application/ld+json">
        {JSON.stringify(
          schemaGenerator({
            location,
            canonical,
            siteUrl,
            pageTitle,
            siteTitle,
            pageTitleFull: fullTitle,
          })
        )}
      </script>
    </Helmet>
  );
};

Head.propTypes = {
  siteTitle: PropTypes.string,
  siteTitleShort: PropTypes.string,
  siteDescription: PropTypes.string,
  seoDescription: PropTypes.string,
  siteUrl: PropTypes.string,
  parentSiteUrl: PropTypes.string,
  themeColor: PropTypes.string,
  social: PropTypes.objectOf(PropTypes.string),
  imageUrl: PropTypes.string,
  pageTitle: PropTypes.string,
  location: PropTypes.object.isRequired,
};

function HeadWithQuery(props) {
  const data = useStaticQuery(graphql`
    query {
      site {
        siteMetadata {
          siteTitle
          siteTitleShort
          siteDescription
          siteUrl
          parentSiteUrl
          themeColor
          social {
            twitter
            fbAppId
          }
        }
      }
    }
  `);

  return (
    <Location>
      {({ location }) => (
        <Head {...data.site.siteMetadata} {...props} location={location} />
      )}
    </Location>
  );
}

export default HeadWithQuery;
