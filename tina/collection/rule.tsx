import { embedTemplates } from "@/components/embeds";
import { Collection } from "tinacms";

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
    },
  ],
};

export default Rule;
