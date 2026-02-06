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

  return {
    ...values,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: userName ?? "",
    lastUpdatedByEmail: userEmail ?? "",
  };
};

export const historyAfterSubmit = async ({ form, cms, values }: { form: Form; cms: TinaCMS; values: Record<string, any> }) => {
  if (!values?.uri) return;

  const formType = form.crudType === "create" ? "create" : "update";
  const categories = Array.isArray(values.categories) ? values.categories : [];

  const shouldCallAPI = formType === "create" ? categories.length > 0 : true;

  if (!shouldCallAPI) return;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/update-category`, {
      method: "POST",
      headers: {
        ...getBearerAuthHeader(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        categories,
        ruleUri: values.uri,
        formType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error(`Failed to update categories for ${formType} form (after submit):`, errorData);
    } else {
      console.log(`[update-category] success for ${formType} form, uri=${values.uri}`);
    }
  } catch (error) {
    console.error(`Error updating categories for ${formType} form (after submit):`, error);
  }
};
