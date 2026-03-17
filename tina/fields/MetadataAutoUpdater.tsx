"use client";

import React, { useEffect, useRef } from "react";
import { useCMS, wrapFieldsWithMeta } from "tinacms";
import { hideFieldWrapper } from "./hideFieldWrapper";

/**
 * Hidden field component that **reactively** populates the three
 * "last updated" metadata fields (`lastUpdated`, `lastUpdatedBy`,
 * `lastUpdatedByEmail`) as soon as the form becomes dirty.
 *
 * ### Why this exists
 * TinaCMS's editorial-workflow path (protected branch → "Create Branch"
 * modal) captures `tinaForm.values` and sends them directly to the
 * backend **without** calling `beforeSubmit`.  Fields that rely solely
 * on `beforeSubmit` (like the hidden `lastUpdated*` fields) therefore
 * remain empty on the very first save.
 *
 * By using a custom field component — the same pattern already used by
 * `UserInfoField` for `createdBy` / `createdByEmail` — we push the
 * metadata into the live form state so that it is present in
 * `tinaForm.values` no matter which save path fires.
 *
 * `beforeSubmit` still runs on non-editorial saves and will overwrite
 * with an exact save-time timestamp, so normal saves stay precise.
 */
const MetadataAutoUpdaterInner: React.FC<any> = ({ tinaForm }) => {
  const cms = useCMS();
  const hasUpdated = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hide the surrounding field wrapper (label + description) in the sidebar.
  useEffect(() => hideFieldWrapper(containerRef), []);

  // Subscribe to dirty state and push metadata into the form.
  useEffect(() => {
    if (hasUpdated.current) return;

    const finalForm = tinaForm?.finalForm;
    if (!finalForm) return;

    const pushMetadata = async () => {
      if (hasUpdated.current) return;
      hasUpdated.current = true;

      let userName = "Unknown";
      let userEmail = "Unknown";

      try {
        const user = await cms.api?.tina?.authProvider?.getUser();
        if (user) {
          userName = user.fullName || "Unknown";
          userEmail = user.email || "Unknown";
        }
      } catch (err) {
        console.error("MetadataAutoUpdater: auth error", err);
      }

      // Use finalForm.change() so the values land in tinaForm.values
      // and are picked up by both the normal onSubmit path AND the
      // editorial-workflow modal that reads tinaForm.values directly.
      finalForm.change("lastUpdated", new Date().toISOString());
      finalForm.change("lastUpdatedBy", userName);
      finalForm.change("lastUpdatedByEmail", userEmail);
    };

    // Subscribe to dirty changes on the form.
    // When the user makes their first edit the form goes dirty → we inject metadata.
    const unsubscribe = finalForm.subscribe(
      ({ dirty }: { dirty: boolean }) => {
        if (dirty && !hasUpdated.current) {
          pushMetadata();
        }
      },
      { dirty: true },
    );

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tinaForm]);

  return <div ref={containerRef} style={{ display: "none" }} />;
};

export const MetadataAutoUpdater = wrapFieldsWithMeta(MetadataAutoUpdaterInner);
