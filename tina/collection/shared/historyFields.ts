import { Form, TinaCMS, TinaField } from "tinacms";
import { getBearerAuthHeader } from "@/utils/tina/get-bearer-auth-header";
import { ConditionalHiddenField } from "../../fields/ConditionalHiddenField";

export const historyFields: TinaField[] = [
  {
    type: "datetime",
    name: "lastUpdated",
    description: "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
    label: "Last Updated",
    ui: {
      component: "hidden",
    },
  },
  {
    type: "string",
    name: "lastUpdatedBy",
    label: "Last Updated By",
    description: "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
    ui: {
      component: "hidden",
    },
  },
  {
    type: "string",
    name: "lastUpdatedByEmail",
    label: "Last Updated By Email",
    description: "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
    ui: {
      component: "hidden",
    },
  },
  {
    type: "boolean",
    name: "isArchived",
    label: "Archived",
    description: "Mark this rule as archived.",
    ui: {
      component: ConditionalHiddenField,
    },
  },
  {
    type: "string",
    name: "archivedreason",
    label: "Archived Reason",
    description: "If this rule has been archived, summarise why here. Only required if 'Archived' is checked.",
    ui: {
      validate: (value: any, allValue: any) => {
        const stringValue = Array.isArray(value) ? value[0] : value;
        if (!allValue.isArchived && stringValue?.length) {
          return "You cannot provide an archived reason if the rule is not archived.";
        }

        if (allValue.isArchived && !stringValue?.length) {
          return "Please provide a reason when archiving this rule.";
        }
      },
      component: ConditionalHiddenField,
      // @ts-expect-error - hideCondition, watchFields, and textarea are custom properties for ConditionalHiddenField
      hideCondition: (values: any) => {
        // Hide the field if isArchived is false, undefined, or null
        // Show the field only when isArchived is explicitly true
        return values?.isArchived !== true;
      },
      watchFields: ["isArchived"], // Specify which fields to watch for changes
      textarea: true, // Render as textarea instead of input
      rows: 3, // Number of rows for the textarea
    },
  },
];

export const historyBeforeSubmit = async ({ form, cms, values }: { form: Form; cms: TinaCMS; values: Record<string, any> }) => {
  if (typeof values.uri === "string") {
    values = { ...values, uri: values.uri.trim() };
  }

  let userEmail: string | undefined;
  let userName: string | undefined;

  // Update categories for both create and update forms
  // The API will read the category index from file to preserve existing rules (including non-existent ones)
  // For create forms, the API constructs the rule path from URI without validation
  // For update forms, the API uses GraphQL but falls back to file-based index if needed
  // For update forms, empty categories array (or undefined/null) means remove rule from all categories
  // For create forms, we only call the API if there are categories to add
  if (values.uri) {
    const formType = form.crudType === "create" ? "create" : "update";

    // Normalize categories - ensure it's always an array
    const categories = Array.isArray(values.categories) ? values.categories : [];

    const shouldCallAPI =
      formType === "create"
        ? categories.length > 0 // For create, only call if there are categories to add
        : true; // For update, always call (even if empty, to remove from all categories)

    if (shouldCallAPI) {
      // Resolve the current branch from TinaCMS client (set by editorial workflow before beforeSubmit fires)
      // This is more reliable than the x-branch cookie which may not be propagated yet
      const tinaBranch = cms.api.tina?.branch || "";
      const cookieBranch =
        typeof document !== "undefined"
          ? (document.cookie
              .split("; ")
              .find((c) => c.startsWith("x-branch="))
              ?.split("=")[1] || "")
          : "";
      const resolvedBranch = tinaBranch || cookieBranch;

      console.log(
        `[historyBeforeSubmit] Branch resolution — tinaBranch: "${tinaBranch}", cookieBranch: "${cookieBranch}", resolved: "${resolvedBranch}"`
      );

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/update-category`, {
          method: "POST",
          headers: {
            ...getBearerAuthHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            categories: categories,
            ruleUri: values.uri,
            formType: formType,
            branch: resolvedBranch || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error(`Failed to update categories for ${formType} form:`, errorData);
          cms.alerts?.error?.(
            `Category index update failed: ${errorData?.error || errorData?.details || "Unknown error"}. The rule will be saved, but category pages may not reflect the change until re-saved.`
          );
        } else {
          const responseData = await response.json().catch(() => null);
          const added = responseData?.AddedCategories?.length || 0;
          const deleted = responseData?.DeletedCategories?.length || 0;
          if (added > 0 || deleted > 0) {
            cms.alerts?.info?.(
              `Category indexes updated: ${added > 0 ? `${added} added` : ""}${added > 0 && deleted > 0 ? ", " : ""}${deleted > 0 ? `${deleted} removed` : ""}`
            );
          }
        }
      } catch (error) {
        console.error(`Error updating categories for ${form.crudType} form:`, error);
        cms.alerts?.error?.(
          `Category index update encountered an error. The rule will be saved, but category pages may not reflect the change until re-saved.`
        );
        // Don't throw - allow form submission to continue even if category update fails
      }
    }
  }
  try {
    const user = await cms.api.tina?.authProvider?.getUser();
    if (user) {
      userEmail = user.email;
      userName = user.fullName;
    }
  } catch (err) {
    console.error("Auth error:", err);
    userEmail = undefined;
    userName = undefined;
  }

  if (form.crudType === "create") {
    return {
      ...values,
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: userName ?? "",
      lastUpdatedByEmail: userEmail ?? "",
    };
  }

  return {
    ...values,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: userName ?? "",
    lastUpdatedByEmail: userEmail ?? "",
  };
};
