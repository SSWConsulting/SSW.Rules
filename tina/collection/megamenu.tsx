import { availableWidgets, iconMap } from "ssw.megamenu";
import type { Collection } from "tinacms";

export const MegaMenu: Collection = {
  label: "Global - Mega Menu",
  name: "megamenu",
  path: "megamenu",
  format: "json",
  ui: {
    global: true,
    allowedActions: {
      create: false,
      delete: false,
    },
  },
  fields: [
    {
      type: "object",
      name: "menuGroups",
      label: "Menu Groups",
      list: true,
      required: true,
      ui: {
        itemProps: (item) => {
          return { label: item?.name };
        },
      },
      fields: [
        {
          type: "object",
          name: "menuColumns",
          label: "Menu Columns",
          list: true,
          ui: {
            itemProps: (item) => {
              if (!item?.menuColumnGroups) return { label: "Column" };
              return {
                label: (item?.menuColumnGroups[0]?.name || "") + " Column",
              };
            },
          },
          fields: [
            {
              type: "object",
              name: "menuColumnGroups",
              label: "Menu Column Groups",
              list: true,
              ui: {
                itemProps: (item) => {
                  return { label: item?.name };
                },
              },
              fields: [
                {
                  type: "string",
                  name: "name",
                  label: "Name",
                  required: true,
                },
                {
                  type: "object",
                  name: "menuItems",
                  label: "Menu Items",
                  list: true,
                  ui: {
                    itemProps: (item) => {
                      return { label: item?.name };
                    },
                  },
                  fields: [
                    {
                      type: "string",
                      name: "name",
                      label: "Name",
                      required: true,
                    },
                    {
                      type: "string",
                      name: "url",
                      label: "URL",
                      required: true,
                    },
                    {
                      type: "string",
                      name: "description",
                      label: "Description",
                    },
                    {
                      type: "image",
                      name: "iconImg",
                      label: "Icon",
                      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                      // @ts-ignore
                      uploadDir: () => "/megamenu-icons",
                    },
                    {
                      type: "string",
                      name: "documentationLink",
                      label: "Link to Documentation",
                    },
                    {
                      type: "string",
                      name: "youtubeLink",
                      label: "Link to YouTube Channel",
                    },
                    {
                      type: "string",
                      name: "icon",
                      label: "Icon (optional override of above image field)",
                      options: Object.keys(iconMap),
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "object",
          name: "sidebarItems",
          label: "Sidebar Items",
          list: true,
          ui: {
            itemProps: (item) => {
              return { label: item?.name };
            },
          },
          fields: [
            {
              type: "string",
              name: "name",
              label: "Name",
              required: true,
            },
            {
              type: "image",
              name: "iconImg",
              label: "Icon",
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              uploadDir: () => "/megamenu-icons",
            },
            {
              type: "string",
              name: "icon",
              label: "Icon (optional override of above image field)",
              options: Object.keys(iconMap),
            },
            {
              type: "object",
              name: "items",
              label: "Items",
              ui: {
                itemProps: (item) => {
                  return { label: item?.name };
                },
              },
              list: true,
              fields: [
                {
                  type: "string",
                  name: "name",
                  label: "Name",
                  required: true,
                },
                {
                  type: "string",
                  name: "url",
                  label: "URL",
                  required: true,
                },
                {
                  type: "string",
                  name: "description",
                  label: "Description",
                },
                {
                  type: "string",
                  name: "widgetType",
                  label: "Widget Type",
                  options: [...availableWidgets],
                },
                {
                  type: "string",
                  name: "icon",
                  label: "Icon",
                  options: Object.keys(iconMap),
                },
              ],
            },
          ],
        },
        {
          type: "object",
          name: "viewAll",
          label: "View All Link",
          fields: [
            {
              type: "string",
              name: "name",
              label: "Text",
              required: true,
            },
            {
              type: "string",
              name: "url",
              label: "URL",
              required: true,
            },
          ],
        },
        {
          type: "string",
          name: "url",
          label: "URL (optional for single link items without a dropdown)",
        },
      ],
    },
  ],
};
