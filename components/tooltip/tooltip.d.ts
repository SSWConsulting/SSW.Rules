import type { ReactNode } from "react";

interface TooltipProps {
  children: ReactNode;
  text: string;
  showDelay?: number;
  hideDelay?: number;
  className?: string;
  opaque?: boolean;
}

declare const Tooltip: (props: TooltipProps) => JSX.Element;
export default Tooltip;
