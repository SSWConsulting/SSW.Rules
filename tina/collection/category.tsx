import React from "react";
import { Collection, wrapFieldsWithMeta } from "tinacms";
import { embedTemplates } from "@/components/embeds";
import { generateGuid } from "@/utils/guidGenerationUtils";
import { ReadonlyUriInput } from "../fields/ReadonlyUriInput";
import { RuleSelector } from "../fields/RuleSelector";
import { historyBeforeSubmit, historyFields } from "./shared/historyFields";
import { toolbarFields } from "./shared/toolbarFields";

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
          const slugifiedTitle = values?.title?.toLowerCase().trim().replace(/ /g, "-").replace("?", "");
          return `${slugifiedTitle}/index`;
        } else {
          return `${values?.title?.toLowerCase().trim().replace(/ /g, "-").replace("?", "")}`;
        }
      },
      description: 'Main category will be "index", top categories will be "{title}/index", and regular categories will use the title as filename',
    },
    beforeSubmit: historyBeforeSubmit,
  },
  templates: [
    // main category file that contains top categories
    {
      name: "main",
      label: "Main Category",
      ui: {
        defaultItem: () => {
          return {
            type: "main",
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
          type: "object",
          label: "Categories",
          name: "index",
          list: true,
          ui: {
            itemProps: (item) => {
              const name = item.top_category?.split("/");
              return {
                label: name ? name[1] : "Top category is not selected",
              };
            },
          },
          fields: [
            {
              type: "reference",
              label: "Category",
              name: "top_category",
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
          description:
            "The URI of the top category. Should match the title in lowercase with spaces replaced by dashes (e.g., 'Azure DevOps' -> 'azure-devops')",
          ui: {
            component: wrapFieldsWithMeta((props) => <ReadonlyUriInput {...props} />),
          },
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
                label: name ? name[name.length - 1].split(".")[0] : "Category is not selected",
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
          ui: {
            component: wrapFieldsWithMeta((props) => <ReadonlyUriInput {...props} />),
          },
        },
        {
          type: "string",
          name: "guid",
          label: "Guid",
          description: "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
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
          description:
            "Note: The rules listed here are only used for sorting on the category page. To assign a category, open the specific rule and select the category there. This list updates automatically based on those assignments, but any rule added directly to this list will not update on its own.",
          ui: {
            itemProps: (item) => ({ label: item.rule?.split("/").at(-2) || "Select a Rule" }),
            max: -1, // this disable the rules to be added to the category
          },
          fields: [
            {
              type: "reference",
              label: "Rule",
              name: "rule",
              collections: ["rule"],
              ui: {
                component: RuleSelector,
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
          templates: embedTemplates,
          toolbarOverride: toolbarFields,
        },
        ...historyFields,
      ],
    },
  ],
};

export default Category;
