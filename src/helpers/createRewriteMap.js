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

module.exports = {
  writeRewriteMapsFile,
};
