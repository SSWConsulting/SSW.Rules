"use client";

import React, { useEffect, useRef } from "react";
import { useCMS, wrapFieldsWithMeta } from "tinacms";
import { hideFieldWrapper } from "./hideFieldWrapper";

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

  // Hide the field wrapper (including label and description) in the sidebar.
  useEffect(() => hideFieldWrapper(containerRef), []);

  useEffect(() => {
    // Only set createdBy/createdByEmail on NEW rules (create mode).
    // When editing an existing rule, these fields should keep whatever
    // value is already in the frontmatter — even if it's "Unknown" or empty.
    // Updating a rule does NOT mean you created it.
    if (hasUpdated.current || tinaForm?.crudType !== "create") {
      return;
    }

    // Only update if the value is still the default "Unknown"
    if (input.value && input.value !== "Unknown") {
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
