const fs = require('fs');

const fileName = 'admin/index.html';

fs.copyFile(`./static/${fileName}`, `./public/${fileName}`, (err) => {
  if (err) throw err;
  // eslint-disable-next-line no-console
  console.log('Index file copied to build output');
});
