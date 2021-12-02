const fs = require('fs-extra');

const createHistoryFeed = async (pluginData, pages, graphql) => {
  const { publicFolder } = pluginData;
  const FILE_PATH = publicFolder('history-feed.json');
  const pageData = Array.from(pages.values()).map((page) => {
    return {
      path: page.path,
      id: page.context.id,
      file: page.context.file,
      title: page.context.title,
      uri: page.context.uri,
    };
  });

  const result = await graphql(`
    query {
      history: allHistoryJson(
        sort: { fields: lastUpdated, order: DESC }
        filter: { file: { glob: "rules/**" } }
        limit: 100
      ) {
        edges {
          node {
            id
            file
            lastUpdated
            lastUpdatedBy
            lastUpdatedByEmail
          }
        }
      }
    }
  `);

  const nodes = Array.from(
    result.data.history.edges.map(({ node }) => {
      var currentPage = pageData.find((x) => node.file == x.file);

      return {
        id: node.id,
        lastUpdated: node.lastUpdated,
        lastUpdatedBy: node.lastUpdatedBy,
        lastUpdatedByEmail: node.lastUpdatedByEmail,
        file: node.file,
        title: currentPage?.title,
        uri: currentPage?.uri,
      };
    })
  );

  const data = `[ ${nodes.map((x) => JSON.stringify(x)).join(',')} ]`;

  return fs.writeFile(FILE_PATH, data);
};

module.exports = {
  createHistoryFeed,
};
