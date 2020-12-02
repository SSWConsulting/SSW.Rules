const fetch = require('node-fetch');
const fs = require('fs-extra');

const writeRewriteMapsFile = (pluginData, rewrites) => {
  const { publicFolder } = pluginData;

  const FILE_PATH = publicFolder('rewritemaps.xml');

  rewrites = rewrites.map(
    ({ fromPath, toPath }) => `<add key="${fromPath}" value="${toPath}" />`
  );

  const data = `
    <rewriteMaps>
      <rewriteMap name="StaticRewrites" defaultValue="">
        ${[...rewrites].join('\n')}
      </rewriteMap>
    </rewriteMaps>`;

  return fs.writeFile(FILE_PATH, data);
};

//Retrive Old Nicknames to preserve redirects
const getExistingRewrites = async () => {
  var newRewritesJson = [];
  if (process.env.REWRITES_JSON_URL !== 'FALSE') {
    await fetch(process.env.REWRITES_JSON_URL)
      .then(response => response.json())
      .then(data => {
        newRewritesJson = data;
      });
  }
  return newRewritesJson;
};

module.exports = {
  writeRewriteMapsFile,
  getExistingRewrites,
};
