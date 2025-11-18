"use client";

import React, { useEffect, useRef } from "react";
import { GroupListFieldPlugin, ImageField, MdxFieldPluginExtendible, ToggleFieldPlugin, wrapFieldsWithMeta } from "tinacms";

/**
 * Conditionally hides string, rich-text, boolean, image, and list fields (and their labels) on create mode,
 * except for 'title' and 'uri' fields.
 *
 * This component hides the field and its label when:
 * - crudType is "create"
 * - field type is "string", "rich-text", "boolean", "image", or has list: true
 * - field name is not "title" or "uri"
 *
 * Uses a combination of returning null and CSS to ensure both field and label are hidden.
 */
export const ConditionalHiddenField = wrapFieldsWithMeta((props: any) => {
  const { field, tinaForm, input, form, meta } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if this is a root-level title or uri field that should remain visible
  const isRootLevelTitle = field.name === "title" && field.isTitle === true;
  const isRootLevelUri = field.name === "uri" && !input.name.includes("."); // Root level fields don't have dots in their path

  // Check if this is a list field
  const isListField = field.list === true;

  // Check if we should hide this field (supports string, rich-text, boolean, image, and list types)
  const shouldHide =
    tinaForm?.crudType === "create" &&
    (field.type === "string" || field.type === "rich-text" || field.type === "boolean" || field.type === "image" || isListField) &&
    !isRootLevelTitle &&
    !isRootLevelUri;

  // Hide the entire field wrapper (including label) using CSS
  useEffect(() => {
    if (shouldHide && containerRef.current) {
      // Traverse up the DOM to find the field wrapper that contains the label
      let element: HTMLElement | null = containerRef.current;
      for (let i = 0; i < 5 && element; i++) {
        element = element.parentElement;
        if (element) {
          // Hide the parent that likely contains both label and field
          // This is a common pattern in form libraries
          const hasLabel = element.querySelector("label") || element.querySelector('[class*="label"]') || element.getAttribute("data-tina-field");
          if (hasLabel || i >= 2) {
            element.style.display = "none";
            break;
          }
        }
      }
    }

    // For image, rich-text, boolean, and list fields, hide the outer label added by wrapFieldsWithMeta
    // since ImageField, MdxFieldPluginExtendible.Component, ToggleFieldPlugin, and GroupListFieldPlugin already have their own labels
    if ((field.type === "image" || field.type === "rich-text" || field.type === "boolean" || isListField) && !shouldHide && containerRef.current) {
      // Find the field wrapper that contains both the outer label and our component
      let element: HTMLElement | null = containerRef.current;
      // Traverse up to find the field wrapper
      for (let i = 0; i < 6 && element; i++) {
        element = element.parentElement;
        if (element) {
          // Look for labels that are direct children (these are usually from wrapFieldsWithMeta)
          // ImageField's, MdxFieldPluginExtendible's, ToggleFieldPlugin's, and GroupListFieldPlugin's labels will be nested deeper inside
          const directChildLabels = Array.from(element.children).filter((child) => child.tagName === "LABEL" || child.querySelector("label"));
          if (directChildLabels.length > 0) {
            // Hide the direct child label (outer label from wrapFieldsWithMeta)
            const labelToHide = directChildLabels[0].tagName === "LABEL" ? directChildLabels[0] : directChildLabels[0].querySelector("label");
            if (labelToHide) {
              (labelToHide as HTMLElement).style.display = "none";
            }
            break;
          }
          // Alternative: Look for label elements and hide the one that's not inside our containerRef
          const allLabels = element.querySelectorAll("label");
          if (allLabels.length > 0) {
            // Find the label that's not a descendant of our containerRef
            for (const label of Array.from(allLabels)) {
              if (!containerRef.current?.contains(label)) {
                (label as HTMLElement).style.display = "none";
                break;
              }
            }
          }
        }
      }
    }
  }, [shouldHide, field.type, isListField]);

  // Return null to hide the field input itself
  if (shouldHide) {
    return <div ref={containerRef} style={{ display: "none" }} />;
  }

  // For boolean fields, use Tina's ToggleFieldPlugin component
  if (field.type === "boolean") {
    return (
      <div ref={containerRef}>
        <ToggleFieldPlugin.Component {...props} />
      </div>
    );
  }

  if (field.type === "image") {
    // Wrap ImageField in a div with ref so we can find and hide the outer label
    return (
      <div ref={containerRef}>
        <ImageField {...props} />
      </div>
    );
  }

  if (field.type === "rich-text") {
    // Wrap MdxFieldPluginExtendible.Component in a div with ref so we can find and hide the outer label
    return (
      <div ref={containerRef}>
        <MdxFieldPluginExtendible.Component {...props} />
      </div>
    );
  }

  if (isListField) {
    // Wrap ListFieldPlugin in a div with ref so we can find and hide the outer label
    return (
      <div ref={containerRef}>
        <GroupListFieldPlugin.Component {...props} />
      </div>
    );
  }

  // For string fields, render the default string input
  return (
    <div ref={containerRef}>
      <input
        type="text"
        id={input.name}
        {...input}
        className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      />
    </div>
  );
});
