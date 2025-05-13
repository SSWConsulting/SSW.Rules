import { embedTemplates } from "@/components/embeds";
import React from "react";
import { Collection, Form, TinaCMS } from "tinacms";

const Rule: Collection = {
  name: "rule",
  label: "Rule",
  path: "content/rule",
  format: "mdx",
  ui: {
    router: ({ document }) => {
      return document._sys.filename;
    },
    filename: {
      readonly: true,
      slugify: (values) => {
        return `${values?.title
          ?.toLowerCase()
          .replace(/ /g, "-")
          .replace("?", "")}`;
      },
    },
    // TODO: make this work
    // beforeSubmit: async ({
    //   form,
    //   cms,
    //   values,
    // }: {
    //   form: Form;
    //   cms: TinaCMS;
    //   values: Record<string, any>;
    // }) => {
    //   const updatedCategories = values.categories.map((cat: any) => ({
    //     ...cat,
    //     categoryName: cat.category.split("/").pop().replace(".md", ""),
    //   }));
    //   return {
    //     ...values,
    //     categories: updatedCategories,
    //   };
    // },
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
          // TODO : find a way to fetch category name through local json file and remove categoryName field
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
      templates: embedTemplates,
    },
  ],
};

export default Rule;
