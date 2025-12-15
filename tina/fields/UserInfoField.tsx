"use client";

import React, { useEffect, useRef } from "react";
import { useCMS, wrapFieldsWithMeta } from "tinacms";

/**
 * Custom field component that fetches the logged-in user info
 * and updates the form field value after the form is initialized.
 * This allows us to set user info without blocking form initialization.
 * Also hides the label and description on create mode.
 */
export const UserInfoField = wrapFieldsWithMeta((props: any) => {
  const { input, field, tinaForm } = props;
  const cms = useCMS();
  const hasUpdated = React.useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hide the field wrapper (including label and description) on create mode
  useEffect(() => {
    const shouldHide = tinaForm?.crudType === "create";

    if (shouldHide) {
      // Find the field wrapper element (similar to ConditionalHiddenField)
      const findFieldWrapperElement = (): HTMLElement | null => {
        if (!containerRef.current) return null;

        let element: HTMLElement | null = containerRef.current;
        const maxDepth = 5;

        for (let depth = 0; depth < maxDepth && element; depth++) {
          element = element.parentElement;
          if (!element) break;

          // Check if this element contains a label
          const hasLabel = element.querySelector("label") || element.querySelector('[class*="label"]') || element.getAttribute("data-tina-field");

          // If we found a label or reached a reasonable depth, this is likely the wrapper
          if (hasLabel || depth >= 2) {
            return element;
          }
        }

        return null;
      };

      const fieldWrapper = findFieldWrapperElement();
      if (fieldWrapper) {
        fieldWrapper.style.display = "none";
      }
    }
  }, [tinaForm?.crudType]);

  useEffect(() => {
    // Only update once, and only if the value is still "Unknown" (default)
    if (hasUpdated.current || (input.value && input.value !== "Unknown")) {
      return;
    }

    const fetchUser = async () => {
      try {
        const user = await cms.api?.tina?.authProvider?.getUser();
        if (user) {
          const value = field.name === "createdByEmail" ? user.email || "Unknown" : user.fullName || "Unknown";

          // Update the form field value
          input.onChange(value);
          hasUpdated.current = true;
        }
      } catch (err) {
        console.error(`Error fetching user for ${field.name}:`, err);
        // Keep "Unknown" as default if fetch fails
      }
    };

    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Return hidden div to maintain form structure
  return <div ref={containerRef} style={{ display: "none" }} />;
});
