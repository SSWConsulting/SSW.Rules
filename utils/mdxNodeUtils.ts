export const removeEndOfIntroHiddenProp = (node: any): any => {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map(removeEndOfIntroHiddenProp);
  }

  if (Array.isArray(node.children)) {
    node.children = node.children.map(removeEndOfIntroHiddenProp);
  }

  if (node.name === "endOfIntro" && node.props) {
    const { _hidden, ...restProps } = node.props;
    node.props = restProps;
  }

  return node;
};

export const countEndOfIntro = (node: any): number => {
  if (!node) return 0;
  if (Array.isArray(node)) {
    return node.reduce((sum, child) => sum + countEndOfIntro(child), 0);
  }
  if (typeof node !== "object") return 0;

  let sum = node.name === "endOfIntro" ? 1 : 0;

  if (Array.isArray(node.children)) {
    sum += countEndOfIntro(node.children);
  }

  return sum;
};
