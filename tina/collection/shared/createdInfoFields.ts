import { TinaField } from "tinacms";
import { UserInfoField } from "../../fields/UserInfoField";

/**
 * Shared fields for tracking who created a document.
 * These fields automatically fetch and set the logged-in user's information
 * when creating a new document, and hide the label/description on create mode.
 */
export const createdInfoFields: TinaField[] = [
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
      component: UserInfoField,
    },
  },
  {
    type: "string",
    name: "createdByEmail",
    label: "Created By Email",
    description: "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
    ui: {
      component: UserInfoField,
    },
  },
];
