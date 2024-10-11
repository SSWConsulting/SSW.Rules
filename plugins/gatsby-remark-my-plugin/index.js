module.exports = async ({ markdownAST }, pluginOptions) => {
  const visit = (await import('unist-util-visit')).default;
  visit(markdownAST, 'text', (node) => {
    // Example: Replace "foo" with "bar"
    console.log('visiting nodes!');
    node.value = node.value.replace(/!/g, '\\');
  });
  return markdownAST;
};
