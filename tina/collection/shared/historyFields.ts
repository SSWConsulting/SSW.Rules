import { Form, TinaCMS, TinaField } from "tinacms";
import { getBearerAuthHeader } from "@/utils/tina/get-bearer-auth-header";

export const historyFields: TinaField[] = [
  {
    type: "datetime",
    name: "created",
    description: "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
    label: "Created",
    ui: {
      component: "hidden",
    },
  },
  {
    type: "string",
    name: "createdBy",
    label: "Created By",
    description: "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
    ui: {
      component: "hidden",
    },
  },
  {
    type: "string",
    name: "createdByEmail",
    label: "Created By Email",
    description: "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
    ui: {
      component: "hidden",
    },
  },
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
  },
  {
    type: "string",
    name: "archivedreason",
    label: "Archived Reason",
    description: "If this rule has been archived, summarise why here. Only required if 'Archived' is checked.",
    ui: {
      validate: (value, allValue) => {
        if (!allValue.archived && value?.length) {
          return "You cannot provide an archived reason if the rule is not archived.";
        }

        if (allValue.archived && !value?.length) {
          return "Please provide a reason when archiving this rule.";
        }
      },
    },
  },
];

export const historyBeforeSubmit = async ({ form, cms, values }: { form: Form; cms: TinaCMS; values: Record<string, any> }) => {
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
    return {
      ...values,
      created: new Date().toISOString(),
      createdBy: userName ?? "",
      createdByEmail: userEmail ?? "",
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
