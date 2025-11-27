"use client";

import React, { useEffect, useRef, useState } from "react";
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
 * Additionally, if a custom condition is provided via field.ui.hideCondition, it will be evaluated
 * to determine if the field should be hidden. The condition function receives form values and should return a boolean.
 *
 * Optionally, you can specify which fields to watch via field.ui.watchFields (array of field names).
 * If not provided, the component will watch all form inputs for changes.
 *
 * Example usage:
 * {
 *   ui: {
 *     component: ConditionalHiddenField,
 *     hideCondition: (values) => values?.someField !== true,
 *     watchFields: ["someField"] // Optional: specify which fields to watch
 *   }
 * }
 *
 * Uses a combination of returning null and CSS to ensure both field and label are hidden.
 */
export const ConditionalHiddenField = wrapFieldsWithMeta((props: any) => {
  const { field, tinaForm, input, form, meta } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Checks if this field should always remain visible (title or uri fields)
   */
  const isAlwaysVisibleField = () => {
    const isTitle = field.name === "title" && field.isTitle === true;
    const isUri = field.name === "uri" && !input.name.includes(".");
    return isTitle || isUri;
  };

  /**
   * Gets form values from multiple possible sources
   */
  const getFormValues = () => {
    return form?.values || form?.getState?.()?.values || {};
  };

  /**
   * Reads a field value directly from the DOM as a fallback
   */
  const readFieldValueFromDOM = (fieldName: string): any => {
    const selector = `input[name="${fieldName}"], select[name="${fieldName}"], textarea[name="${fieldName}"]`;
    const element = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;

    if (!element) return undefined;

    // Handle checkbox inputs differently
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      return element.checked;
    }

    return element.value;
  };

  /**
   * Gets form values, with fallback to reading from DOM for specified fields
   */
  const getFormValuesWithDOMFallback = (fieldsToWatch: string[]): Record<string, any> => {
    let formValues = getFormValues();

    // If form values don't have the watched fields, try reading from DOM
    const domValues: Record<string, any> = {};
    fieldsToWatch.forEach((fieldName) => {
      if (formValues[fieldName] === undefined) {
        const domValue = readFieldValueFromDOM(fieldName);
        if (domValue !== undefined) {
          domValues[fieldName] = domValue;
        }
      }
    });

    return { ...formValues, ...domValues };
  };

  /**
   * Finds DOM elements for the specified field names
   */
  const findFieldElements = (fieldNames: string[]): HTMLElement[] => {
    const elements: HTMLElement[] = [];

    fieldNames.forEach((fieldName) => {
      const selectors = [
        `input[name="${fieldName}"]`,
        `input[type="checkbox"][name*="${fieldName}"]`,
        `select[name="${fieldName}"]`,
        `textarea[name="${fieldName}"]`,
        `[data-tina-field*="${fieldName}"] input`,
        `[data-tina-field*="${fieldName}"] button`,
        `[data-tina-field*="${fieldName}"] select`,
      ];

      selectors.forEach((selector) => {
        const element = document.querySelector(selector);
        if (element && !elements.includes(element as HTMLElement)) {
          elements.push(element as HTMLElement);
        }
      });
    });

    return elements;
  };

  /**
   * Finds all form input elements in the document
   */
  const findAllFormInputs = (): HTMLElement[] => {
    const elements: HTMLElement[] = [];
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!elements.includes(el as HTMLElement)) {
        elements.push(el as HTMLElement);
      }
    });
    return elements;
  };

  /**
   * Sets up event listeners on elements to watch for changes
   */
  const setupFieldWatchers = (elements: HTMLElement[], onChange: () => void) => {
    elements.forEach((element) => {
      element.addEventListener("change", onChange);
      element.addEventListener("click", onChange);
      element.addEventListener("input", onChange);
    });

    return () => {
      elements.forEach((element) => {
        element.removeEventListener("change", onChange);
        element.removeEventListener("click", onChange);
        element.removeEventListener("input", onChange);
      });
    };
  };

  /**
   * Finds the parent element that contains the field label
   */
  const findFieldWrapperElement = (): HTMLElement | null => {
    if (!containerRef.current) return null;

    let element: HTMLElement | null = containerRef.current;
    const maxDepth = 5;

    for (let depth = 0; depth < maxDepth && element; depth++) {
      element = element.parentElement;
      if (!element) break;

      // Check if this element contains a label
      const hasLabel =
        element.querySelector("label") ||
        element.querySelector('[class*="label"]') ||
        element.getAttribute("data-tina-field");

      // If we found a label or reached a reasonable depth, this is likely the wrapper
      if (hasLabel || depth >= 2) {
        return element;
      }
    }

    return null;
  };

  /**
   * Hides the outer label added by wrapFieldsWithMeta for certain field types
   */
  const hideOuterLabel = () => {
    if (!containerRef.current) return;

    const fieldTypesWithBuiltInLabels = ["image", "rich-text", "boolean"];
    const shouldHideLabel = fieldTypesWithBuiltInLabels.includes(field.type) || field.list === true;

    if (!shouldHideLabel) return;

    let element: HTMLElement | null = containerRef.current;
    const maxDepth = 6;

    for (let depth = 0; depth < maxDepth && element; depth++) {
      element = element.parentElement;
      if (!element) break;

      // Look for direct child labels (usually from wrapFieldsWithMeta)
      const directChildLabels = Array.from(element.children).filter(
        (child) => child.tagName === "LABEL" || child.querySelector("label")
      );

      if (directChildLabels.length > 0) {
        const labelToHide =
          directChildLabels[0].tagName === "LABEL"
            ? directChildLabels[0]
            : directChildLabels[0].querySelector("label");

        if (labelToHide) {
          (labelToHide as HTMLElement).style.display = "none";
          return;
        }
      }

      // Alternative: find labels that are not inside our container
      const allLabels = element.querySelectorAll("label");
      for (const label of Array.from(allLabels)) {
        if (!containerRef.current?.contains(label)) {
          (label as HTMLElement).style.display = "none";
          return;
        }
      }
    }
  };

  // ============================================================================
  // FIELD TYPE CHECKS
  // ============================================================================

  const isListField = field.list === true;
  const isAlwaysVisible = isAlwaysVisibleField();

  // ============================================================================
  // CUSTOM CONDITION LOGIC
  // ============================================================================

  const customCondition = field.ui?.hideCondition;
  const watchFields = field.ui?.watchFields as string[] | undefined;

  // Initialize state with custom condition evaluation
  const [customShouldHide, setCustomShouldHide] = useState<boolean>(() => {
    if (!customCondition || typeof customCondition !== "function" || !form) {
      return false;
    }

    try {
      const formValues = getFormValues();
      return customCondition(formValues);
    } catch (error) {
      console.error("Error evaluating hideCondition:", error);
      return false;
    }
  });

  // Watch for changes when custom condition is present
  useEffect(() => {
    if (!customCondition || typeof customCondition !== "function" || !form) {
      return;
    }

    const evaluateCondition = () => {
      try {
        // Get form values, with DOM fallback for watched fields
        const fieldsToCheck = watchFields && Array.isArray(watchFields) ? watchFields : [];
        const formValues = fieldsToCheck.length > 0 ? getFormValuesWithDOMFallback(fieldsToCheck) : getFormValues();

        const shouldHide = customCondition(formValues);
        setCustomShouldHide(shouldHide);
      } catch (error) {
        console.error("Error evaluating hideCondition:", error);
      }
    };

    // Evaluate immediately
    evaluateCondition();

    // Set up polling as a fallback (TinaCMS may not expose a proper watch API)
    const pollInterval = setInterval(evaluateCondition, 150);

    // Set up DOM event listeners for more responsive updates
    const elementsToWatch =
      watchFields && Array.isArray(watchFields) && watchFields.length > 0
        ? findFieldElements(watchFields)
        : findAllFormInputs();

    const handleFieldChange = () => {
      // Small delay to ensure form values are updated
      setTimeout(evaluateCondition, 100);
    };

    const cleanupWatchers = setupFieldWatchers(elementsToWatch, handleFieldChange);

    return () => {
      clearInterval(pollInterval);
      cleanupWatchers();
    };
  }, [customCondition, form, watchFields]);

  // ============================================================================
  // DETERMINE IF FIELD SHOULD BE HIDDEN
  // ============================================================================

  // Default behavior: hide on create mode for certain field types
  const shouldHideByDefault =
    tinaForm?.crudType === "create" &&
    (field.type === "string" ||
      field.type === "rich-text" ||
      field.type === "boolean" ||
      field.type === "image" ||
      isListField) &&
    !isAlwaysVisible;

  // Use custom condition if provided, otherwise use default behavior
  const shouldHide = customCondition ? customShouldHide : shouldHideByDefault;

  // ============================================================================
  // HANDLE FIELD VISIBILITY
  // ============================================================================

  // Hide/show the field wrapper (including label) using CSS
  useEffect(() => {
    const fieldWrapper = findFieldWrapperElement();
    if (fieldWrapper) {
      fieldWrapper.style.display = shouldHide ? "none" : "";
    }

    // Hide outer label for fields that have built-in labels
    if (!shouldHide) {
      hideOuterLabel();
    }
  }, [shouldHide, field.type, isListField]);

  // ============================================================================
  // RENDER FIELD INPUT
  // ============================================================================

  // If field should be hidden, return empty div
  if (shouldHide) {
    return <div ref={containerRef} style={{ display: "none" }} />;
  }

  // Render appropriate input component based on field type
  const renderFieldInput = () => {
    switch (field.type) {
      case "boolean":
        return (
          <div ref={containerRef}>
            <ToggleFieldPlugin.Component {...props} />
          </div>
        );

      case "image":
        return (
          <div ref={containerRef}>
            <ImageField {...props} />
          </div>
        );

      case "rich-text":
        return (
          <div ref={containerRef}>
            <MdxFieldPluginExtendible.Component {...props} />
          </div>
        );

      default:
        // Handle list fields
        if (isListField) {
          return (
            <div ref={containerRef}>
              <GroupListFieldPlugin.Component {...props} />
            </div>
          );
        }

        // Default: string input
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
    }
  };

  return renderFieldInput();
});
