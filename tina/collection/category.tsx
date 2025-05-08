import { Collection } from "tinacms";

const Category: Collection = {
  name: "categories",
  label: "Categories",
  path: "content/categories",
  format: "md",
  templates: [
    {
      name: "top_category",
      label: "Top Level Category",
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
              const name = item.index?.split("/");
              return {
                label: name
                  ? name[name.length - 1].split(".")[0]
                  : "Choose Category",
              };
            },
          },
          fields: [
            {
              type: "reference",
              label: "Category",
              name: "index",
              collections: ["categories"],
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
          type: "rich-text",
          name: "body",
          label: "Body",
          isBody: true,
          description: "This is description of the category",
        },
      ],
    },
  ],
};

export default Category;
