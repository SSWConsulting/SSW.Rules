/// A script to update the 'siteUrlRelative' config attribute on build.
/// This is required as upon hosting, '/rules' is prefixed to all URLS
/// but we want to ensure the attribute still works when testing local.

const fs = require('fs');

const fileName = './site-config.js';

fs.readFile(fileName, 'utf8', function (err, contents) {
  if (err) {
    return process.stdout.write(err);
  }

  const newConents = contents.replace(
    'siteUrlRelative: `/`',
    'siteUrlRelative: `/rules`'
  );

  fs.writeFile(fileName, newConents, 'utf8', function (err) {
    if (err) return process.stdout.write(err);
  });
});
