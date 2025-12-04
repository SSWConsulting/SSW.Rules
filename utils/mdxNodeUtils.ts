export const removeEndIntroHiddenProp = (node: any): any => {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map(removeEndIntroHiddenProp);
  }

  if (Array.isArray(node.children)) {
    node.children = node.children.map(removeEndIntroHiddenProp);
  }

  if (node.name === "endIntro" && node.props) {
    const { _hidden, ...restProps } = node.props;
    node.props = restProps;
  }

  return node;
};

export const countEndIntro = (node: any): number => {
  if (!node) return 0;
  if (Array.isArray(node)) {
    return node.reduce((sum, child) => sum + countEndIntro(child), 0);
  }
  if (typeof node !== "object") return 0;

  let sum = node.name === "endIntro" ? 1 : 0;

  if (Array.isArray(node.children)) {
    sum += countEndIntro(node.children);
  }

  return sum;
};
