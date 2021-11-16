export const sanitizeName = (file, slug) =>
  slug
    ? file.slice(1, file.length - 6)
    : file.node.file.slice(0, file.node.file.length - 8);
