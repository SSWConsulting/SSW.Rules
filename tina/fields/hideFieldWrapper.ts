/**
 * Hides the TinaCMS field wrapper element (label + description) in the sidebar
 * by walking up the DOM from the given container reference.
 *
 * TinaCMS's `wrapFieldsWithMeta` adds a wrapping element that includes a label
 * and description text. For fields that should be invisible in the sidebar
 * (e.g. MetadataAutoUpdater, UserInfoField), this function hides that wrapper.
 */
export function hideFieldWrapper(containerRef: { current: HTMLElement | null }): void {
  if (!containerRef.current) return;

  let el: HTMLElement | null = containerRef.current;
  for (let depth = 0; depth < 5 && el; depth++) {
    el = el.parentElement;
    if (!el) break;
    const hasLabel = el.querySelector("label") || el.querySelector('[class*="label"]') || el.getAttribute("data-tina-field");
    if (hasLabel || depth >= 2) {
      el.style.display = "none";
      break;
    }
  }
}
