import React from "react";
type MenuWrapperProps = {
  children: React.ReactNode;
};
export const MenuWrapper = (props: MenuWrapperProps) => {
  return <div className="[&_a]:no-underline">{props.children}</div>;
};
