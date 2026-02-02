const fs = require("fs");
const path = require("path");

let archivedSlugs = [];
try {
  archivedSlugs = JSON.parse(
    fs.readFileSync(path.join(__dirname, "archived-rules.json"), "utf-8")
  );
} catch {
  console.warn("⚠️ archived-rules.json not found — archived rules will not be excluded from sitemap");
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
