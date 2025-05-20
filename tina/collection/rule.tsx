import { embedTemplates } from "@/components/embeds";
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
          .trim()
          .replace(/ /g, "-")
          .replace("?", "")}`;
      },
    },
    beforeSubmit: async ({
      form,
      cms,
      values,
    }: {
      form: Form
      cms: TinaCMS
      values: Record<string, any>
    }) => {
      if (form.crudType === 'create') {
        return {
          ...values,
          created: new Date().toISOString(),
        }
      }

      return {
        ...values,
        lastUpdated: new Date().toISOString(),
      }
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
      type: "rich-text",
      label: "Rule Content",
      name: "content",
      required: true,
      templates: embedTemplates,
      isBody: true
    },
    {
      type: 'datetime',
      name: 'created',
      label: 'Created',
      ui: {
        component: 'hidden',
      },
    },
    {
      type: 'datetime',
      name: 'lastUpdated',
      label: 'Last Updated',
      ui: {
        component: 'hidden',
      },
    },
  ],
};

export default Rule;
