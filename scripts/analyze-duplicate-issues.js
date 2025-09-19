#!/usr/bin/env node

/**
 * Script to analyze duplicate issues in the SSW.Rules repository
 * This script analyzes the sample of issues we already have and creates patterns for identification
 */

const fs = require('fs');
const path = require('path');

// Note: This script analyzes patterns based on observed issues in the repository
// Analysis is based on manual review of recent issues in the SSW.Rules repository

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
 * Create patterns for identifying common duplicate issues
 */
function identifyCommonPatterns(issues) {
  const patterns = {
    buildIssues: [],
    uiIssues: [],
    bugReports: [],
    featureRequests: [],
    migrationIssues: [],
    authenticationIssues: [],
    performanceIssues: [],
  };

  issues.forEach((issue) => {
    const title = issue.title.toLowerCase();
    const body = (issue.body || '').toLowerCase();
    const content = title + ' ' + body;

    // Build/deployment issues
    if (
      content.includes('build') ||
      content.includes('deploy') ||
      content.includes('cache') ||
      content.includes('workflow')
    ) {
      patterns.buildIssues.push(issue);
    }

    // UI/Frontend issues
    if (
      content.includes('ui') ||
      content.includes('button') ||
      content.includes('page') ||
      content.includes('display') ||
      content.includes('style')
    ) {
      patterns.uiIssues.push(issue);
    }

    // Bug reports
    if (
      title.includes('🐛') ||
      title.includes('bug') ||
      content.includes('error') ||
      content.includes('broken')
    ) {
      patterns.bugReports.push(issue);
    }

    // Feature requests
    if (
      title.includes('✨') ||
      title.includes('feature') ||
      content.includes('implement') ||
      content.includes('add')
    ) {
      patterns.featureRequests.push(issue);
    }

    // Migration issues
    if (
      content.includes('migration') ||
      content.includes('tina') ||
      content.includes('poc') ||
      content.includes('v3')
    ) {
      patterns.migrationIssues.push(issue);
    }

    // Authentication issues
    if (
      content.includes('auth') ||
      content.includes('login') ||
      content.includes('token') ||
      content.includes('401')
    ) {
      patterns.authenticationIssues.push(issue);
    }

    // Performance issues
    if (
      content.includes('performance') ||
      content.includes('slow') ||
      content.includes('loading') ||
      content.includes('timeout')
    ) {
      patterns.performanceIssues.push(issue);
    }
  });

  return patterns;
}

/**
 * Find potential duplicates based on manual analysis of the issues we've seen
 */
function analyzeKnownDuplicatePatterns() {
  const knownPatterns = [
    {
      pattern: 'TinaCMS Migration Issues',
      description:
        'Multiple issues related to TinaCMS migration, broken images, and MDX problems',
      potentialDuplicates: [
        {
          number: 1933,
          title:
            '🐛 Bug - Fix Broken Images and HTML Rendering in Rules (Content)',
        },
        {
          number: 1930,
          title:
            '🐛 Bug - MDX Issues in Rules (Content) on Staging Environment',
        },
        {
          number: 1878,
          title:
            '🐛 Bug - Investigate and Fix Broken Images on Azure Deployment',
        },
      ],
      recommendation:
        'These issues seem to be related to content rendering problems in the TinaCMS migration. Consider consolidating into a single issue.',
    },
    {
      pattern: 'Missing UI Components',
      description:
        'Multiple issues about missing buttons and UI elements on the migration website',
      potentialDuplicates: [
        {
          number: 1929,
          title:
            '🐛 Bug - Missing Buttons and related page (Orphaned, Archived) on Migration Website',
        },
        {
          number: 1926,
          title:
            "🐛 Bug - Missing 'Include Archive' Button on Migration Website",
        },
        {
          number: 1912,
          title:
            '✨ ✨ Category Page - Add Missing "Show Titles Only" Button to POC Website',
        },
      ],
      recommendation:
        'These are all about missing UI components. Could be combined into a single comprehensive UI completion issue.',
    },
    {
      pattern: 'Authentication and Token Issues',
      description:
        'Multiple issues related to authentication, login loops, and token persistence',
      potentialDuplicates: [
        {
          number: 1921,
          title:
            '🐛 Bug - Infinite Login and Fork Loop on Rules (Content) Page',
        },
        {
          number: 1915,
          title:
            '🐛 Bug - 401 Error on Page Reload Due to Token Persistence Issue',
        },
      ],
      recommendation:
        'Both issues seem related to authentication problems. Consider investigating if they have the same root cause.',
    },
    {
      pattern: 'Homepage Implementation',
      description:
        'Multiple issues about implementing features on the homepage',
      potentialDuplicates: [
        {
          number: 1902,
          title: '✨ Add Right panel missing part SSW Rules POC',
        },
        { number: 1896, title: '💄Homepage - Polish homepage' },
        { number: 1895, title: '✨ Homepage - Add latest rules to homepage' },
      ],
      recommendation:
        'These could potentially be consolidated into a single homepage enhancement epic.',
    },
    {
      pattern: 'Build and Deployment Issues',
      description: 'Issues related to build failures and deployment problems',
      potentialDuplicates: [
        {
          number: 1937,
          title:
            '🐛 Bug - Exceeding Cache Limit in TinaCMS - NDC Migration Repository',
        },
        {
          number: 1928,
          title:
            '🐛 Bug - Production Build Failing Due to URI Issue in Rules (Gatsby)',
        },
        { number: 1907, title: '👷 Build - Fix build issues' },
      ],
      recommendation:
        'Consider if these build issues are related and could benefit from a unified approach.',
    },
  ];

  return knownPatterns;
}

/**
 * Generate comprehensive duplicate analysis report
 */
function generateDuplicateReport() {
  const patterns = analyzeKnownDuplicatePatterns();

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPatterns: patterns.length,
      totalIssuesAnalyzed: patterns.reduce(
        (sum, pattern) => sum + pattern.potentialDuplicates.length,
        0
      ),
      analysisMethod:
        'Manual pattern recognition based on issue titles and content',
    },
    duplicatePatterns: patterns,
    recommendations: [
      {
        priority: 'High',
        action: 'Review TinaCMS migration issues',
        description:
          'Multiple issues (#1933, #1930, #1878) seem to be related to content rendering problems. Consider consolidating or creating an epic to track all migration-related rendering issues.',
      },
      {
        priority: 'High',
        action: 'Consolidate missing UI component issues',
        description:
          'Issues #1929, #1926, #1912 are all about missing UI components on the migration site. These could be tracked under a single comprehensive UI completion issue.',
      },
      {
        priority: 'Medium',
        action: 'Investigate authentication issues',
        description:
          'Issues #1921 and #1915 both relate to authentication problems. They may share the same root cause and could benefit from a unified investigation.',
      },
      {
        priority: 'Medium',
        action: 'Create homepage enhancement epic',
        description:
          'Issues #1902, #1896, #1895 could be organized under a single homepage enhancement epic for better tracking.',
      },
      {
        priority: 'Low',
        action: 'Review build-related issues',
        description:
          'Build issues (#1937, #1928, #1907) may benefit from a systematic approach to build optimization.',
      },
    ],
    automationSuggestions: [
      'Implement issue templates that help users search for existing issues before creating new ones',
      "Add labels like 'duplicate' and 'needs-triage' to help identify and manage potential duplicates",
      'Create issue workflows that automatically suggest similar issues based on title keywords',
      'Implement a periodic review process for issues with similar keywords or labels',
    ],
  };

  return report;
}

/**
 * Main function
 */
function main() {
  console.log('=== SSW.Rules Repository Duplicate Issue Analysis ===\n');

  // Generate the duplicate analysis report
  const report = generateDuplicateReport();

  // Save report to file
  const outputFile = path.join(__dirname, 'duplicate-issues-analysis.json');
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));

  // Display findings
  console.log(
    `Analysis complete. Found ${report.summary.totalPatterns} potential duplicate patterns.\n`
  );

  console.log('=== DUPLICATE PATTERNS IDENTIFIED ===\n');

  report.duplicatePatterns.forEach((pattern, index) => {
    console.log(`${index + 1}. ${pattern.pattern}`);
    console.log(`   Description: ${pattern.description}`);
    console.log('   Potential Duplicates:');
    pattern.potentialDuplicates.forEach((issue) => {
      console.log(`   • #${issue.number}: ${issue.title}`);
    });
    console.log(`   Recommendation: ${pattern.recommendation}\n`);
  });

  console.log('=== PRIORITY RECOMMENDATIONS ===\n');

  report.recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. [${rec.priority} Priority] ${rec.action}`);
    console.log(`   ${rec.description}\n`);
  });

  console.log('=== PROCESS IMPROVEMENT SUGGESTIONS ===\n');

  report.automationSuggestions.forEach((suggestion, index) => {
    console.log(`${index + 1}. ${suggestion}`);
  });

  console.log(`\nDetailed report saved to: ${outputFile}`);
  console.log('\n=== NEXT STEPS ===');
  console.log('1. Review the identified duplicate patterns');
  console.log('2. Consider consolidating related issues into epics');
  console.log('3. Implement suggested process improvements');
  console.log('4. Set up regular duplicate detection reviews');
}

// Run the analysis
if (require.main === module) {
  main();
}

module.exports = {
  calculateSimilarity,
  normalizeTitle,
  extractKeywords,
  identifyCommonPatterns,
  analyzeKnownDuplicatePatterns,
  generateDuplicateReport,
};
