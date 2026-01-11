import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Fetches a URL and returns the response text
 */
async function fetchUrl(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SitemapCrawler/1.0)",
      },
    });
    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error.message}`);
  }
}

/**
 * Parses sitemap XML and extracts all URLs
 * Handles both regular sitemaps and sitemap index files
 */
async function parseSitemap(sitemapUrl) {
  const urls = new Set();
  const sitemapsToProcess = [sitemapUrl];
  const processedSitemaps = new Set();

  while (sitemapsToProcess.length > 0) {
    const currentSitemap = sitemapsToProcess.shift();
    
    if (processedSitemaps.has(currentSitemap)) {
      continue;
    }
    
    processedSitemaps.add(currentSitemap);
    console.log(`Fetching sitemap: ${currentSitemap}`);

    try {
      const xmlContent = await fetchUrl(currentSitemap);
      
      // Check if this is a sitemap index (contains <sitemap> tags)
      const sitemapIndexRegex = /<sitemap[^>]*>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/gi;
      const sitemapMatches = [...xmlContent.matchAll(sitemapIndexRegex)];
      
      if (sitemapMatches.length > 0) {
        // This is a sitemap index, add child sitemaps to process
        console.log(`Found sitemap index with ${sitemapMatches.length} child sitemaps`);
        for (const match of sitemapMatches) {
          const childSitemapUrl = match[1].trim();
          if (!processedSitemaps.has(childSitemapUrl)) {
            sitemapsToProcess.push(childSitemapUrl);
          }
        }
        continue;
      }

      // Extract URLs from regular sitemap
      const urlRegex = /<url[^>]*>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/url>/gi;
      const urlMatches = [...xmlContent.matchAll(urlRegex)];
      
      for (const match of urlMatches) {
        const url = match[1].trim();
        urls.add(url);
      }
      
      console.log(`Extracted ${urlMatches.length} URLs from ${currentSitemap}`);
    } catch (error) {
      console.error(`Error processing sitemap ${currentSitemap}: ${error.message}`);
    }
  }

  return Array.from(urls);
}

/**
 * Checks the HTTP status of a URL
 */
async function checkUrlStatus(url, options = {}) {
  const { timeout = 10000, retries = 2 } = options;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: "HEAD", // Use HEAD to save bandwidth
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SitemapCrawler/1.0)",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);
      return {
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      };
    } catch (error) {
      if (attempt === retries) {
        return {
          url,
          status: 0,
          statusText: error.name === "AbortError" ? "Timeout" : error.message,
          ok: false,
        };
      }
      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

/**
 * Generates HTML report
 */
function generateHtmlReport(results) {
  const {
    totalPages,
    status200,
    status404,
    otherStatuses,
    errors,
    startTime,
    endTime,
  } = results;

  const duration = ((endTime - startTime) / 1000).toFixed(2);
  const successRate = totalPages > 0 ? ((status200 / totalPages) * 100).toFixed(2) : 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sitemap Crawl Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 30px;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-card.success {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        .stat-card.error {
            background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        }
        .stat-card.warning {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .stat-value {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .section {
            margin-top: 40px;
        }
        .section h2 {
            color: #2c3e50;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #ecf0f1;
        }
        .url-list {
            list-style: none;
        }
        .url-item {
            padding: 12px;
            margin-bottom: 8px;
            background: #f8f9fa;
            border-left: 4px solid #3498db;
            border-radius: 4px;
            transition: background 0.2s;
        }
        .url-item:hover {
            background: #e9ecef;
        }
        .url-item.error {
            border-left-color: #e74c3c;
        }
        .url-item.warning {
            border-left-color: #f39c12;
        }
        .url-link {
            color: #3498db;
            text-decoration: none;
            word-break: break-all;
        }
        .url-link:hover {
            text-decoration: underline;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: bold;
            margin-left: 10px;
        }
        .status-200 {
            background: #27ae60;
            color: white;
        }
        .status-404 {
            background: #e74c3c;
            color: white;
        }
        .status-other {
            background: #f39c12;
            color: white;
        }
        .status-error {
            background: #8e44ad;
            color: white;
        }
        .meta-info {
            background: #ecf0f1;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 30px;
            font-size: 0.9em;
        }
        .meta-info strong {
            color: #2c3e50;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Sitemap Crawl Report</h1>
        
        <div class="meta-info">
            <strong>Generated:</strong> ${new Date(endTime).toLocaleString()}<br>
            <strong>Duration:</strong> ${duration} seconds<br>
            <strong>Sitemap URL:</strong> <a href="${results.sitemapUrl}" target="_blank">${results.sitemapUrl}</a>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${totalPages}</div>
                <div class="stat-label">Total Pages</div>
            </div>
            <div class="stat-card success">
                <div class="stat-value">${status200}</div>
                <div class="stat-label">Status 200</div>
            </div>
            <div class="stat-card error">
                <div class="stat-value">${status404}</div>
                <div class="stat-label">Status 404</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-value">${otherStatuses.length}</div>
                <div class="stat-label">Other Statuses</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${successRate}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        </div>

        ${status404 > 0 ? `
        <div class="section">
            <h2>❌ 404 Not Found Pages (${status404})</h2>
            <ul class="url-list">
                ${results.status404Urls.map(url => `
                    <li class="url-item error">
                        <a href="${url}" target="_blank" class="url-link">${url}</a>
                        <span class="status-badge status-404">404</span>
                    </li>
                `).join('')}
            </ul>
        </div>
        ` : ''}

        ${otherStatuses.length > 0 ? `
        <div class="section">
            <h2>⚠️ Other Non-200 Status Codes (${otherStatuses.length})</h2>
            <ul class="url-list">
                ${otherStatuses.map(item => `
                    <li class="url-item warning">
                        <a href="${item.url}" target="_blank" class="url-link">${item.url}</a>
                        <span class="status-badge status-other">${item.status} ${item.statusText}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
        ` : ''}

        ${errors.length > 0 ? `
        <div class="section">
            <h2>🚫 Errors (${errors.length})</h2>
            <ul class="url-list">
                ${errors.map(item => `
                    <li class="url-item error">
                        <a href="${item.url}" target="_blank" class="url-link">${item.url}</a>
                        <span class="status-badge status-error">Error: ${item.statusText}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
        ` : ''}

        ${status200 === totalPages ? `
        <div class="section">
            <h2>✅ All pages returned status 200!</h2>
            <p>Great job! All ${totalPages} pages in the sitemap are accessible.</p>
        </div>
        ` : ''}
    </div>
</body>
</html>`;

  return html;
}

/**
 * Main function
 */
async function main() {
  const sitemapUrl = process.argv[2];

  if (!sitemapUrl) {
    console.error("Usage: node crawl-sitemap.js <sitemap-url>");
    console.error("Example: node crawl-sitemap.js https://example.com/sitemap.xml");
    process.exit(1);
  }

  console.log(`Starting sitemap crawl for: ${sitemapUrl}\n`);

  const startTime = Date.now();

  try {
    // Parse sitemap and extract URLs
    const urls = await parseSitemap(sitemapUrl);
    console.log(`\nFound ${urls.length} URLs to check\n`);

    if (urls.length === 0) {
      console.error("No URLs found in sitemap!");
      process.exit(1);
    }

    // Check status of each URL
    const results = {
      status200: 0,
      status404: 0,
      status404Urls: [],
      otherStatuses: [],
      errors: [],
    };

    let processed = 0;
    const batchSize = 10; // Process 10 URLs concurrently

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const promises = batch.map((url) => checkUrlStatus(url));
      const batchResults = await Promise.all(promises);

      for (const result of batchResults) {
        processed++;
        if (result.status === 200) {
          results.status200++;
        } else if (result.status === 404) {
          results.status404++;
          results.status404Urls.push(result.url);
        } else if (result.status === 0) {
          results.errors.push(result);
        } else {
          results.otherStatuses.push(result);
        }

        // Progress indicator
        if (processed % 50 === 0 || processed === urls.length) {
          console.log(`Progress: ${processed}/${urls.length} (${((processed / urls.length) * 100).toFixed(1)}%)`);
        }
      }

      // Small delay between batches to avoid overwhelming the server
      if (i + batchSize < urls.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const endTime = Date.now();

    // Generate report data
    const reportData = {
      sitemapUrl,
      totalPages: urls.length,
      status200: results.status200,
      status404: results.status404,
      status404Urls: results.status404Urls,
      otherStatuses: results.otherStatuses,
      errors: results.errors,
      startTime,
      endTime,
    };

    // Generate HTML report
    const htmlReport = generateHtmlReport(reportData);
    const reportPath = join(__dirname, "../sitemap-crawl-report.html");
    fs.writeFileSync(reportPath, htmlReport, "utf-8");

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("CRAWL SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total pages crawled: ${urls.length}`);
    console.log(`Status 200: ${results.status200}`);
    console.log(`Status 404: ${results.status404}`);
    console.log(`Other statuses: ${results.otherStatuses.length}`);
    console.log(`Errors: ${results.errors.length}`);
    console.log(`Duration: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
    console.log(`\nHTML report saved to: ${reportPath}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
