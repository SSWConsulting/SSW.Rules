"use client";

import { useEffect, useRef } from "react";

const LOG_PREFIX = "[AdminBackBlock]";

const CONFIRM_MESSAGE =
  "If you go back you'll lose your changes. Do you want to stay on this page?";

export interface UseAdminBackBlockOptions {
  /** When true, the hook sets up back-button blocking and form-dirty detection. From useIsAdminPage().isAdmin */
  isAdminPage: boolean;
  /** Optional label for console logs (e.g. "ServerRulePage", "ClientFallbackPage") */
  debugLabel?: string;
}

/**
 * In the Tina admin, the rule preview runs in an iframe. This hook:
 * - Listens for postMessage "updateData" from the parent (when the user edits the form) and tracks "form has unsaved changes".
 * - On the top window: pushes a history state and listens for popstate (back button). When the user goes back, only shows
 *   the leave-confirmation alert if there are unsaved changes; otherwise allows navigation.
 * - Uses window.top for history/alert so the dialog is visible when running inside the preview iframe.
 */
export function useAdminBackBlock({
  isAdminPage,
  debugLabel,
}: UseAdminBackBlockOptions): void {
  const formHasUnsavedChangesRef = useRef(false);

  // Track form dirty: parent sends "updateData" when the user edits in the Tina form.
  useEffect(() => {
    if (!isAdminPage || typeof window === "undefined") return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "updateData") {
        formHasUnsavedChangesRef.current = true;
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isAdminPage]);

  // Block back / leave only when there are unsaved changes. Attach to window.top so we see back button in admin iframe.
  useEffect(() => {
    if (debugLabel) {
      console.log(LOG_PREFIX, `[${debugLabel}] Effect ran.`, {
        isAdminPage,
        hasWindow: typeof window !== "undefined",
        inIframe: typeof window !== "undefined" && window !== window.top,
      });
      if (typeof window !== "undefined" && window !== window.top) {
        console.log(LOG_PREFIX, "Tip: In Tina admin, select the PREVIEW IFRAME in DevTools (Console frame dropdown) to see these logs.");
      }
    }

    if (!isAdminPage || typeof window === "undefined") {
      if (debugLabel) {
        console.log(LOG_PREFIX, "Skipping setup:", { isAdminPage, hasWindow: typeof window !== "undefined" });
      }
      return;
    }

    let win: Window;
    try {
      win = window.top ?? window;
      void win.location.href;
      if (debugLabel) console.log(LOG_PREFIX, "Using window: top (iframe preview)");
    } catch {
      win = window;
      if (debugLabel) console.log(LOG_PREFIX, "Using window: self (fallback)");
    }

    const currentHref = win.location.href;
    win.history.pushState({ blockBack: true }, "", currentHref);
    if (debugLabel) console.log(LOG_PREFIX, "pushState done, href:", currentHref);

    const handlePopState = () => {
      if (formHasUnsavedChangesRef.current) {
        const stay = win.confirm(CONFIRM_MESSAGE);
        if (stay) {
          if (debugLabel) console.log(LOG_PREFIX, "popstate fired – user chose Stay, re-blocking back");
          win.history.pushState({ blockBack: true }, "", win.location.href);
        }
        // If !stay, user chose Leave – do nothing, they navigate away
      }
    };

    win.addEventListener("popstate", handlePopState);
    if (debugLabel) console.log(LOG_PREFIX, "Listeners attached on", win === window ? "self" : "top");

    return () => {
      if (debugLabel) console.log(LOG_PREFIX, "Cleanup: removing listeners");
      win.removeEventListener("popstate", handlePopState);
    };
  }, [isAdminPage, debugLabel]);
}
