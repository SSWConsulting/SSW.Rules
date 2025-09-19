#!/usr/bin/env node

/**
 * Script to find duplicate issues in the SSW.Rules repository
 * This script uses the GitHub API to fetch all issues and analyzes them for potential duplicates
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const REPO_OWNER = 'SSWConsulting';
const REPO_NAME = 'SSW.Rules';
const OUTPUT_FILE = path.join(__dirname, 'duplicate-issues-report.json');
const SIMILARITY_THRESHOLD = 0.7; // Threshold for considering issues as potential duplicates

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;

  const matrix = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLength = Math.max(s1.length, s2.length);
  return 1 - matrix[s2.length][s1.length] / maxLength;
}

/**
 * Clean and normalize issue titles for better comparison
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/^(🐛|✨|💄|🚀|❗️|👷)/, '') // Remove emoji prefixes
    .replace(/^(bug|feature|enhancement|docs|refactor|devops)\s*-?\s*/i, '') // Remove type prefixes
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract keywords from issue content
 */
function extractKeywords(text) {
  if (!text) return [];

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter(
      (word) =>
        ![
          'this',
          'that',
          'with',
          'from',
          'they',
          'have',
          'been',
          'were',
          'will',
          'your',
          'should',
          'would',
          'could',
        ].includes(word)
    );
}

/**
 * Calculate content similarity based on keywords
 */
function calculateContentSimilarity(content1, content2) {
  const keywords1 = extractKeywords(content1);
  const keywords2 = extractKeywords(content2);

  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const intersection = keywords1.filter((word) => keywords2.includes(word));
  const union = [...new Set([...keywords1, ...keywords2])];

  return intersection.length / union.length;
}

/**
 * Check if two issues have similar labels
 */
function haveSimilarLabels(labels1, labels2) {
  const labelNames1 = labels1.map((label) => label.name.toLowerCase());
  const labelNames2 = labels2.map((label) => label.name.toLowerCase());

  const intersection = labelNames1.filter((label) =>
    labelNames2.includes(label)
  );

  // Consider similar if they share at least 2 labels or have significant overlap
  return (
    intersection.length >= 2 ||
    intersection.length / Math.max(labelNames1.length, labelNames2.length) > 0.5
  );
}

/**
 * Fetch all issues from the repository
 */
async function fetchAllIssues() {
  console.log('Fetching all issues from the repository...');

  const issues = [];
  let page = 1;
  const perPage = 100;

  try {
    while (true) {
      const response = await axios.get(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
        {
          params: {
            state: 'all', // Include both open and closed issues
            per_page: perPage,
            page: page,
            sort: 'created',
            direction: 'desc',
          },
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'SSW-Rules-Duplicate-Finder',
          },
        }
      );

      if (response.data.length === 0) {
        break;
      }

      // Filter out pull requests (GitHub API includes PRs in issues endpoint)
      const actualIssues = response.data.filter((issue) => !issue.pull_request);
      issues.push(...actualIssues);

      console.log(
        `Fetched page ${page}, total issues so far: ${issues.length}`
      );

      if (response.data.length < perPage) {
        break;
      }

      page++;

      // Add a small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`Total issues fetched: ${issues.length}`);
    return issues;
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.error(
        'Rate limit exceeded. Please try again later or use authentication.'
      );
    } else {
      console.error('Error fetching issues:', error.message);
    }
    throw error;
  }
}

/**
 * Find potential duplicate issues
 */
function findDuplicates(issues) {
  console.log('Analyzing issues for potential duplicates...');

  const duplicates = [];
  const processed = new Set();

  for (let i = 0; i < issues.length; i++) {
    if (processed.has(issues[i].number)) continue;

    const issue1 = issues[i];
    const potentialDuplicates = [];

    for (let j = i + 1; j < issues.length; j++) {
      if (processed.has(issues[j].number)) continue;

      const issue2 = issues[j];

      // Skip if issues are from the same author and created close to each other
      // This might be intentional follow-ups
      const timeDiff = Math.abs(
        new Date(issue1.created_at) - new Date(issue2.created_at)
      );
      if (
        issue1.user.login === issue2.user.login &&
        timeDiff < 24 * 60 * 60 * 1000
      ) {
        continue;
      }

      // Calculate title similarity
      const titleSimilarity = calculateSimilarity(
        normalizeTitle(issue1.title),
        normalizeTitle(issue2.title)
      );

      // Calculate content similarity
      const contentSimilarity = calculateContentSimilarity(
        issue1.body || '',
        issue2.body || ''
      );

      // Check for similar labels
      const hasSimilarLabels = haveSimilarLabels(
        issue1.labels || [],
        issue2.labels || []
      );

      // Combined similarity score
      let overallSimilarity = titleSimilarity * 0.6 + contentSimilarity * 0.4;

      // Boost score if they have similar labels
      if (hasSimilarLabels) {
        overallSimilarity += 0.1;
      }

      // Consider as potential duplicate if similarity exceeds threshold
      if (overallSimilarity >= SIMILARITY_THRESHOLD || titleSimilarity >= 0.8) {
        potentialDuplicates.push({
          issue: issue2,
          titleSimilarity: titleSimilarity,
          contentSimilarity: contentSimilarity,
          overallSimilarity: overallSimilarity,
          hasSimilarLabels: hasSimilarLabels,
        });
      }
    }

    if (potentialDuplicates.length > 0) {
      duplicates.push({
        primaryIssue: issue1,
        duplicates: potentialDuplicates.sort(
          (a, b) => b.overallSimilarity - a.overallSimilarity
        ),
      });

      // Mark all found duplicates as processed to avoid duplicate reporting
      potentialDuplicates.forEach((dup) => processed.add(dup.issue.number));
      processed.add(issue1.number);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`Processed ${i + 1}/${issues.length} issues...`);
    }
  }

  return duplicates;
}

/**
 * Generate a human-readable report
 */
function generateReport(duplicates) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalDuplicateGroups: duplicates.length,
      totalIssuesInvolved: duplicates.reduce(
        (sum, group) => sum + 1 + group.duplicates.length,
        0
      ),
    },
    duplicateGroups: duplicates.map((group) => ({
      primaryIssue: {
        number: group.primaryIssue.number,
        title: group.primaryIssue.title,
        state: group.primaryIssue.state,
        author: group.primaryIssue.user.login,
        created_at: group.primaryIssue.created_at,
        url: group.primaryIssue.html_url,
        labels: group.primaryIssue.labels.map((label) => label.name),
      },
      potentialDuplicates: group.duplicates.map((dup) => ({
        number: dup.issue.number,
        title: dup.issue.title,
        state: dup.issue.state,
        author: dup.issue.user.login,
        created_at: dup.issue.created_at,
        url: dup.issue.html_url,
        labels: dup.issue.labels.map((label) => label.name),
        similarity: {
          title: Math.round(dup.titleSimilarity * 100) / 100,
          content: Math.round(dup.contentSimilarity * 100) / 100,
          overall: Math.round(dup.overallSimilarity * 100) / 100,
          similarLabels: dup.hasSimilarLabels,
        },
      })),
    })),
  };

  return report;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log(
      'Starting duplicate issue analysis for SSW.Rules repository...'
    );
    console.log(`Similarity threshold: ${SIMILARITY_THRESHOLD}`);
    console.log('');

    // Fetch all issues
    const issues = await fetchAllIssues();

    if (issues.length === 0) {
      console.log('No issues found.');
      return;
    }

    // Find duplicates
    const duplicates = findDuplicates(issues);

    // Generate report
    const report = generateReport(duplicates);

    // Save report to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));

    // Display summary
    console.log('\n=== DUPLICATE ISSUE ANALYSIS COMPLETE ===');
    console.log(`Total issues analyzed: ${issues.length}`);
    console.log(
      `Duplicate groups found: ${report.summary.totalDuplicateGroups}`
    );
    console.log(
      `Total issues involved in duplicates: ${report.summary.totalIssuesInvolved}`
    );
    console.log(`Report saved to: ${OUTPUT_FILE}`);

    // Display top duplicate groups
    if (duplicates.length > 0) {
      console.log('\n=== TOP DUPLICATE GROUPS ===');
      duplicates.slice(0, 5).forEach((group, index) => {
        console.log(
          `\n${index + 1}. Primary Issue #${group.primaryIssue.number}: ${group.primaryIssue.title}`
        );
        group.duplicates.forEach((dup) => {
          console.log(
            `   → Duplicate #${dup.issue.number}: ${dup.issue.title}`
          );
          console.log(
            `     Similarity: ${Math.round(dup.overallSimilarity * 100)}% (Title: ${Math.round(dup.titleSimilarity * 100)}%, Content: ${Math.round(dup.contentSimilarity * 100)}%)`
          );
        });
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  calculateSimilarity,
  normalizeTitle,
  extractKeywords,
  calculateContentSimilarity,
  haveSimilarLabels,
  findDuplicates,
  generateReport,
};
