import { Form, TinaCMS, TinaField } from "tinacms";
import { getBearerAuthHeader } from "@/utils/tina/get-bearer-auth-header";
import { ConditionalHiddenField } from "../../fields/ConditionalHiddenField";
import { MetadataAutoUpdater } from "../../fields/MetadataAutoUpdater";

export const historyFields: TinaField[] = [
  {
    type: "datetime",
    name: "lastUpdated",
    description: "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
    label: "Last Updated",
    ui: {
      // MetadataAutoUpdater reactively sets lastUpdated, lastUpdatedBy, and
      // lastUpdatedByEmail on the live form state as soon as the user makes
      // an edit.  This ensures the values are present in tinaForm.values for
      // the editorial-workflow path (protected branch → CreateBranchModal),
      // which bypasses beforeSubmit entirely.
      component: MetadataAutoUpdater,
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
  // IMPORTANT: mutate `values` in-place instead of creating a new object.
  // TinaCMS's internal handleSubmit calls `form.initialize(values)` with the
  // *original* reference after onSubmit.  If we return a spread-copy, the
  // form state is re-initialised from the stale original and metadata fields
  // are lost until the next save.  Mutating in-place keeps both the saved
  // payload and the re-initialised form state in sync.
  if (typeof values.uri === "string") {
    values.uri = values.uri.trim();
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
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error(`Failed to update categories for ${formType} form:`, errorData);
        }
      } catch (error) {
        console.error(`Error updating categories for ${form.crudType} form:`, error);
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
    // On first save, set createdBy from the auth provider directly (UserInfoField's async
    // onChange may not have settled before the user clicks Save on the first edit).
    values.createdBy = userName ?? values.createdBy ?? "Unknown";
    values.createdByEmail = userEmail ?? values.createdByEmail ?? "Unknown";
    values.lastUpdated = new Date().toISOString();
    // Fall back to "Unknown" so the UI fallback can render on the very first save
    // (empty string is falsy and would cause the metadata section to be hidden).
    values.lastUpdatedBy = userName ?? "Unknown";
    values.lastUpdatedByEmail = userEmail ?? "Unknown";
    return values;
  }

  values.lastUpdated = new Date().toISOString();
  // Prefer the resolved user name; if auth fails, keep the previously saved value
  // rather than overwriting it with an empty string that hides the metadata section.
  values.lastUpdatedBy = userName ?? values.lastUpdatedBy ?? "Unknown";
  values.lastUpdatedByEmail = userEmail ?? values.lastUpdatedByEmail ?? "Unknown";
  return values;
};
