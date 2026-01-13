import { useEffect } from "react";

// Color classes for highlight syntax: ==color:text== or ==text== (defaults to yellow)
const colorClasses: Record<string, string> = {
  yellow: "bg-yellow-200 px-1 py-0.5 rounded-sm",
  red: "bg-[var(--ssw-red)] text-white px-1 py-0.5 rounded-sm",
};

export function useMarkHighlight(
  rootRef: React.RefObject<HTMLElement>,
  selector = "ul li div, ol li div, p, h1, h2, h3, h4, h5, h6"
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const process = () => {
      root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        if (el.dataset.markProcessed === "1") return;
        if (!el.innerHTML.includes("==")) return;

        el.innerHTML = el.innerHTML.replace(
          /==([^=]+)==/g,
          (_, inner) => {
            const trimmed = inner.trim();
            const colonIndex = trimmed.indexOf(":");

            let color = "yellow";
            let text = trimmed;

            if (colonIndex > 0 && colonIndex < 10) {
              const maybeColor = trimmed.substring(0, colonIndex).toLowerCase();
              if (colorClasses[maybeColor]) {
                color = maybeColor;
                text = trimmed.substring(colonIndex + 1).trim();
              }
            }

            return `<mark class="${colorClasses[color]}">${text}</mark>`;
          }
        );
        el.dataset.markProcessed = "1";
      });
    };

    process();
    const mo = new MutationObserver(process);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [rootRef, selector]);
}
