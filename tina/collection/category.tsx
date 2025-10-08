import { generateGuid } from "@/utils/guidGenerationUtils";
import { Collection, Form, TinaCMS } from "tinacms";
import { historyBeforeSubmit, historyFields } from "./shared/historyFields";
import { PaginatedRuleSelectorInput } from "../fields/paginatedRuleSelector";
import { embedTemplates } from "@/components/embeds";

const Category: Collection = {
  name: "category",
  label: "Categories",
  path: "categories",
  format: "mdx",
  ui: {
    filename: {
      readonly: true,
      slugify: (values) => {
        if (values?._template === "main") {
          return "index";
        } else if (values?._template === "top_category") {
          const slugifiedTitle = values?.title
            ?.toLowerCase()
            .trim()
            .replace(/ /g, "-")
            .replace("?", "");
          return `${slugifiedTitle}/index`;
        } else {
          return `${values?.title
            ?.toLowerCase()
            .trim()
            .replace(/ /g, "-")
            .replace("?", "")}`;
        }
      },
      description:
        'Main category will be "index", top categories will be "{title}/index", and regular categories will use the title as filename',
    },
    beforeSubmit: historyBeforeSubmit,
  },
  templates: [
    // main category file that contains top categories
    {
      name: "main",
      label: "Main Category",
      fields: [
        {
          type: "string",
          label: "Title",
          name: "title",
          isTitle: true,
          required: true,
        },
        {
          type: "object",
          label: "Categories",
          name: "index",
          list: true,
          ui: {
            itemProps: (item) => {
              const name = item.category?.split("/");
              return {
                label: name ? name[1] : "Top category is not selected",
              };
            },
          },
          fields: [
            {
              type: "reference",
              label: "Category",
              name: "category",
              collections: ["category"],
              ui: {
                optionComponent: (props: { name: string }, _internalSys) => {
                  return _internalSys.path;
                },
              },
            },
          ],
        },
      ],
    },

    // top category that contains subcategories
    {
      name: "top_category",
      label: "Top Category",
      ui: {
        defaultItem: () => {
          return {
            type: "top_category",
          };
        },
      },
      fields: [
        {
          type: "string",
          label: "Title",
          name: "title",
          isTitle: true,
          required: true,
        },
        {
          type: "string",
          name: "type",
          label: "Type",
          ui: {
            component: "hidden",
          },
        },
        {
          type: "string",
          name: "uri",
          label: "URI",
          description: "The URI of the top category. Should match the title in lowercase with spaces replaced by dashes (e.g., 'Azure DevOps' -> 'azure-devops')",
        },
        {
          type: "object",
          label: "Categories",
          name: "index",
          list: true,
          ui: {
            itemProps: (item) => {
              const name = item.category?.split("/");
              return {
                label: name
                  ? name[name.length - 1].split(".")[0]
                  : "Category is not selected",
              };
            },
          },
          fields: [
            {
              type: "reference",
              label: "Category",
              name: "category",
              collections: ["category"],
              ui: {
                optionComponent: (props: { name: string }, _internalSys) => {
                  return _internalSys.path;
                },
              },
            },
          ],
        },
        ...historyFields,
      ],
    },

    // subcategory that contains rules
    {
      name: "category",
      label: "Category",
      ui: {
        defaultItem: () => {
          return {
            guid: generateGuid(),
          };
        },
      },
      fields: [
        {
          type: "string",
          label: "Title",
          name: "title",
          isTitle: true,
          required: true,
        },
        {
          type: "string",
          name: "uri",
          label: "URI",
          description: "The URI of the category",
        },
        {
          type: "string",
          name: "guid",
          label: "Guid",
          description:
            "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
          ui: {
            component: "hidden",
          },
        },
        {
          type: "string",
          name: "consulting",
          label: "Consulting link",
          description: "Add Consulting link here",
        },
        {
          type: "string",
          name: "experts",
          label: "Experts link",
          description: "Add Experts link here",
        },
        {
          type: "string",
          name: "redirects",
          label: "Redirects",
          list: true,
        },
        {
          type: "object",
          label: "Rules",
          name: "index",
          list: true,
          ui: {
            itemProps: (item) => ({
              label: item.rule?.split("/").at(-2) || "Rule is not selected"
            }),
          },
          fields: [
            {
              type: "reference",
              label: "Rule",
              name: "rule",
              collections: ["rule"],
              ui: {
                component: PaginatedRuleSelectorInput,
              },
            },
          ],
        },
        {
          type: "rich-text",
          name: "body",
          label: "Body",
          isBody: true,
          description: "This is description of the category",
          templates:embedTemplates
        },
        ...historyFields,
      ],
    },
  ],
};

export default Category;
