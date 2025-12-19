import { useEffect } from "react";

export function useMarkHighlight(
  rootRef: React.RefObject<HTMLElement>,
  selector = "ul li div",
  markClass = "bg-yellow-200 px-1 py-0.5 rounded-sm"
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const process = () => {
      root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        if (el.dataset.markProcessed === "1") return;
        el.innerHTML = el.innerHTML.replace(
          /==([\s\S]*?)==/g,
          `<mark class="${markClass}">$1</mark>`
        );
        el.dataset.markProcessed = "1";
      });
    };

    process();
    const mo = new MutationObserver(process);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [rootRef, selector, markClass]);
}
