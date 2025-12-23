#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * This script validates the RSS feed configuration in gatsby-config.js
 * It checks that the required configuration is present and properly structured.
 */

const path = require('path');

console.log('🔍 Validating RSS Feed Configuration...\n');

try {
  // Load gatsby-config.js
  const configPath = path.join(__dirname, '..', 'gatsby-config.js');
  const config = require(configPath);

  // Find the RSS feed plugin
  const feedPlugin = config.plugins.find((plugin) => {
    if (typeof plugin === 'object' && plugin.resolve) {
      return plugin.resolve === 'gatsby-plugin-feed';
    }
    return false;
  });

  if (!feedPlugin) {
    console.error('❌ gatsby-plugin-feed not found in gatsby-config.js');
    process.exit(1);
  }

  console.log('✅ gatsby-plugin-feed found in configuration');

  // Validate feed options
  if (!feedPlugin.options) {
    console.error('❌ Feed plugin has no options');
    process.exit(1);
  }

  console.log('✅ Feed plugin has options');

  // Validate feeds array
  if (!feedPlugin.options.feeds || !Array.isArray(feedPlugin.options.feeds)) {
    console.error('❌ Feed plugin has no feeds array');
    process.exit(1);
  }

  console.log('✅ Feed plugin has feeds array');

  // Validate first feed
  const feed = feedPlugin.options.feeds[0];
  if (!feed) {
    console.error('❌ No feed defined');
    process.exit(1);
  }

  console.log('✅ Feed is defined');

  // Validate feed properties
  const requiredProps = ['serialize', 'query', 'output', 'title'];
  const missingProps = requiredProps.filter((prop) => !feed[prop]);

  if (missingProps.length > 0) {
    console.error(
      `❌ Feed missing required properties: ${missingProps.join(', ')}`
    );
    process.exit(1);
  }

  console.log('✅ Feed has all required properties');

  // Validate output path
  if (feed.output !== '/rss.xml') {
    console.error(`❌ Feed output path is ${feed.output}, expected /rss.xml`);
    process.exit(1);
  }

  console.log('✅ Feed output path is /rss.xml');

  // Validate feed metadata
  console.log('\nFeed Metadata:');
  console.log(`  Title: ${feed.title}`);
  console.log(`  Description: ${feed.description}`);
  console.log(`  Output: ${feed.output}`);
  console.log(`  Site URL: ${feed.site_url}`);
  console.log(`  Feed URL: ${feed.feed_url}`);

  // Validate query includes required fields
  const requiredQueryFields = [
    'allHistoryJson',
    'allMarkdownRemark',
    'lastUpdated',
    'lastUpdatedBy',
  ];
  const queryMissing = requiredQueryFields.filter(
    (field) => !feed.query.includes(field)
  );

  if (queryMissing.length > 0) {
    console.error(
      `⚠️  Warning: Feed query might be missing fields: ${queryMissing.join(', ')}`
    );
  } else {
    console.log('\n✅ Feed query includes all expected fields');
  }

  console.log('\n✅ RSS Feed configuration is valid!');
  console.log(
    '\n💡 The RSS feed will be available at /rss.xml after the site is built.'
  );
  process.exit(0);
} catch (error) {
  console.error('❌ Error validating RSS feed configuration:', error.message);
  process.exit(1);
}
