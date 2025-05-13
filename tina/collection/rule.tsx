import React from "react";
import { Collection, Form, TinaCMS } from "tinacms";
import { generateGuid } from "./category";

const Rule: Collection = {
  name: "rules",
  label: "Rules",
  path: "content/rules",
  format: "md",
  defaultItem: () => {
    return {
      guid: generateGuid(),
    };
  },
  ui: {
    filename: {
      readonly: true,
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
      label: "Categories",
      name: "categories",
      type: "object",
      list: true,
      required: true,
      ui: {
        itemProps: (item) => {
          // TODO : fetch category name through local json file
          return {
            label: item.categoryName,
          };
        },
      },
      fields: [
        {
          type: "string",
          label: "Category name",
          name: "categoryName",
        },
        {
          label: "Choose a category",
          name: "category",
          type: "reference",
          collections: ["categories"],
          ui: {
            optionComponent: (props: any) => {
              if (props && props.title) {
                return (
                  <div className="flex items-center text-base">
                    {props.title}
                  </div>
                );
              } else {
                return <div>No Categories...</div>;
              }
            },
          },
        },
      ],
    },
    {
      type: "rich-text",
      label: "Rule Content",
      name: "content",
      required: true,
    },
  ],
};

export default Rule;
