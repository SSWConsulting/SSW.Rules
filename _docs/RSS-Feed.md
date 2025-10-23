# RSS Feed

SSW Rules provides an RSS feed for recent rules changes at `/rss.xml`.

## Overview

The RSS feed is generated during the build process using the `gatsby-plugin-feed` plugin. It provides:

- The 50 most recently updated rules
- Automatic filtering of archived rules
- Information about who made the last update
- Links to the updated rules
- Rule descriptions from the SEO description or excerpt

## Feed URL

The RSS feed is available at:
- Production: `https://www.ssw.com.au/rules/rss.xml`
- Staging: Check the staging deployment URL and append `/rss.xml`

## Usage

Users can subscribe to this RSS feed using:
- RSS readers (e.g., Feedly, Inoreader)
- Email notifications via Power Automate or similar automation tools
- Custom integrations

## Configuration

The RSS feed is configured in `gatsby-config.js` with the `gatsby-plugin-feed` plugin. The feed:

1. Queries the `history.json` data for recent rule updates
2. Sorts by `lastUpdated` date in descending order
3. Filters out archived rules
4. Limits to the 50 most recent updates
5. Includes metadata such as title, description, author, and publication date

## Technical Details

The feed uses the following data sources:
- `allHistoryJson`: Git history data sorted by last update date
- `allMarkdownRemark`: Rule content including title, excerpt, and SEO description

Each feed item includes:
- **Title**: The rule title
- **Description**: SEO description, excerpt, or update information
- **Date**: Last update timestamp
- **Author**: Last person who updated the rule
- **URL**: Direct link to the rule
