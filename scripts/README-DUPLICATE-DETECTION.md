# Duplicate Issue Detection Tools

This directory contains tools for identifying and analyzing duplicate issues in the SSW.Rules repository.

## 📁 Files

- `find-duplicate-issues.js` - Full-featured duplicate detection using GitHub API (requires authentication)
- `find-duplicate-issues-local.js` - Local duplicate detection using GitHub CLI
- `analyze-duplicate-issues.js` - Manual pattern analysis and reporting tool
- `duplicate-issues-analysis.json` - Generated analysis report (JSON format)
- `DUPLICATE_ISSUES_REPORT.md` - Human-readable analysis report

## 🚀 Quick Start

### Running the Analysis

```bash
# Run the pattern analysis (recommended)
node scripts/analyze-duplicate-issues.js

# Alternative: Use GitHub CLI (requires gh auth login)
node scripts/find-duplicate-issues-local.js

# Alternative: Use GitHub API (requires setup)
node scripts/find-duplicate-issues.js
```

### Adding to npm scripts

Add this to your `package.json`:

```json
{
  "scripts": {
    "find-duplicates": "node scripts/analyze-duplicate-issues.js"
  }
}
```

Then run:
```bash
npm run find-duplicates
```

## 🔍 How It Works

### Pattern Recognition Approach

The analysis tool identifies potential duplicates by looking for common patterns:

1. **TinaCMS Migration Issues** - Content rendering, broken images, MDX problems
2. **Missing UI Components** - Missing buttons and interface elements  
3. **Authentication Issues** - Login loops, token persistence problems
4. **Homepage Implementation** - Multiple homepage feature requests
5. **Build/Deployment Issues** - Build failures and deployment problems

### Similarity Detection

For API-based tools, the system uses:

- **Title Similarity**: Levenshtein distance calculation with normalization
- **Content Analysis**: Keyword extraction and comparison
- **Label Matching**: Identification of issues with similar labels
- **Temporal Analysis**: Detection of issues created close together by the same author

## 📊 Analysis Results

### Current Findings

The analysis has identified **5 duplicate patterns** affecting **14 issues**:

#### High Priority Duplicates
- **TinaCMS Migration Issues** (3 issues) - Content rendering problems
- **Missing UI Components** (3 issues) - Missing buttons and elements

#### Medium Priority Duplicates  
- **Authentication Issues** (2 issues) - Login and token problems
- **Homepage Implementation** (3 issues) - Homepage feature requests

#### Low Priority Duplicates
- **Build/Deployment Issues** (3 issues) - Build and deployment problems

### Recommendations

1. **Consolidate related issues** into epics for better tracking
2. **Implement issue templates** that encourage searching first
3. **Add duplicate detection** to the issue creation workflow
4. **Schedule regular triage** sessions to identify new duplicates

## 🛠️ Configuration

### Similarity Thresholds

You can adjust similarity thresholds in the script files:

```javascript
const SIMILARITY_THRESHOLD = 0.7; // 70% similarity required
```

### Pattern Definitions

Patterns are defined in `analyzeKnownDuplicatePatterns()` function and can be customized based on your repository's specific issues.

## 🔧 GitHub API Setup (Optional)

For the full API-based detection:

1. Create a GitHub personal access token
2. Set environment variable: `GITHUB_TOKEN=your_token_here`
3. Or modify the script to include authorization headers

### GitHub CLI Setup (Alternative)

```bash
# Install GitHub CLI
gh auth login

# Run the local analysis
node scripts/find-duplicate-issues-local.js
```

## 📈 Integration Ideas

### GitHub Actions Workflow

Create `.github/workflows/duplicate-detection.yml`:

```yaml
name: Duplicate Issue Detection
on:
  schedule:
    - cron: '0 0 * * 1' # Weekly on Monday
  workflow_dispatch: # Manual trigger

jobs:
  detect-duplicates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: node scripts/analyze-duplicate-issues.js
      - name: Create Issue
        if: ${{ success() }}
        uses: actions/github-script@v6
        with:
          script: |
            // Create an issue with the duplicate analysis results
            // (implementation details would go here)
```

### Issue Templates

Add to `.github/ISSUE_TEMPLATE/`:

```markdown
## Before Creating This Issue

Please search for existing issues that might be related:
- [ ] I have searched for similar issues
- [ ] I have checked recently closed issues
- [ ] This is not a duplicate of an existing issue

## Related Issues

List any related issues here:
- #issue_number - brief description
```

## 🚀 Future Enhancements

### Planned Features
- [ ] Real-time duplicate detection during issue creation
- [ ] Machine learning-based similarity scoring
- [ ] Integration with issue labeling workflows
- [ ] Automated duplicate marking and linking
- [ ] Historical trend analysis
- [ ] Custom pattern definition UI

### Integration Opportunities
- [ ] GitHub Actions integration for automated detection
- [ ] Slack/Teams notifications for potential duplicates
- [ ] Dashboard for duplicate analytics
- [ ] Integration with project management tools

## 🤝 Contributing

To improve the duplicate detection:

1. **Add new patterns** to `analyzeKnownDuplicatePatterns()`
2. **Improve similarity algorithms** in the detection functions
3. **Add new analysis dimensions** (assignees, milestones, etc.)
4. **Enhance the reporting** format and insights

## 📚 Resources

- [GitHub Issues API Documentation](https://docs.github.com/en/rest/issues)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [Levenshtein Distance Algorithm](https://en.wikipedia.org/wiki/Levenshtein_distance)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

*Last updated: September 2025*