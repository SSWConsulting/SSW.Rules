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
