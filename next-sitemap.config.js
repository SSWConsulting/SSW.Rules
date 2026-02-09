const fs = require("fs");
const path = require("path");

let archivedSlugs = [];
try {
  const jsonPath = path.join(__dirname, "archived-rules.json");
  archivedSlugs = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`📋 Sitemap: Loaded ${archivedSlugs.length} archived slugs from ${jsonPath}`);
  if (archivedSlugs.length > 0) {
    console.log(`📋 Sitemap: Sample slugs: ${archivedSlugs.slice(0, 3).join(", ")}`);
  }
} catch (err) {
  console.warn("⚠️ archived-rules.json not found — archived rules will not be excluded from sitemap");
  console.warn("⚠️ Error:", err.message);
}

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.ssw.com.au"}${process.env.NEXT_PUBLIC_BASE_PATH}`,
  changefreq: "daily",
  priority: 0.7,
  sitemapBaseFileName: "sitemap-index",
  sitemapSize: 5000,
  generateRobotsTxt: true,
  output: "standalone",
  outDir: "public/",
  transform: async (config, path) => {
     if (path.includes("/api") || path.includes("/icon.ico")) {
      return null;
    }

    // Exclude archived rules from sitemap
    const slug = path.replace(/^\//, "").replace(/\/$/, "");
    if (archivedSlugs.includes(slug)) {
      return null;
    }
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: config.lastmod || new Date().toISOString(),
    };
  },
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
  },
};
