import { embedTemplates } from "@/components/embeds";
import { generateGuid } from "@/utils/guidGenerationUtils";
import { Collection, Form, TinaCMS } from "tinacms";
import { historyBeforeSubmit, historyFields } from "./shared/historyFields";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/^\//, "") || ""

const Rule: Collection = {
  name: "rule",
  label: "Rule",
  path: "public/uploads/rules",
  format: "mdx",
  match: {
        include: '**/rule'
  },
  defaultItem() {
    return {
      guid: generateGuid(),
      filename: "rule",
    };
  },
  ui: {
    filename: {
      slugify: (values) => {
        const folder = values?.uri?.trim() || "";
        return folder ? `${folder}/rule` : "rule";
      },
      readonly: true,
    },
    router: ({ document }) => {
      const slug =
        document?._sys?.relativePath?.split("/")?.[0] ??
        "";
      return `${basePath}/${slug}`;
    },
    beforeSubmit: historyBeforeSubmit,
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
      type: "image",
      label: "Rule thumbnail",
      name: "thumbnail",
      description: "Use a JPG or PNG image that is at least 175 x 175px",
    },
    {
      type: "string",
      name: "uri",
      label: "Uri",
      description: "The URI of the rule - this defines the slug and refereces.",
      required: true,
      ui: {
        validate: (value?: string): string | void => {
          const v = (value ?? "").trim();
          if (!v) return "URI is required";
          if (/[A-Z]/.test(v)) return "URI cannot contain uppercase letters";
          if (/\s/.test(v)) return "URI cannot contain spaces";
        },
      },
    },
    {
      type: "object",
      name: "authors",
      label: "Authors",
      description: "The list of contributors for this rule.",
      list: true,
      ui: {
        itemProps: (item) => {
          return { label: "👤 " + (item?.title ?? "Author") };
        },
        defaultItem: {
          title: "Bob Northwind",
          url: "https://ssw.com.au/people/bob-northwind",
        },
      },
      fields: [
        {
          type: "string",
          name: "title",
          description:
            "The full name of the contributor, as it should appear on the rule.",
          label: "Name",
        },
        {
          type: "string",
          description:
            "The SSW People link for the contributor - e.g. https://ssw.com.au/people/bob-northwind",
          name: "url",
          label: "Url",
        },
      ],
    },
    {
      type: "string",
      label: "Related Rules",
      name: "related",
      description:
        "The URIs of rules that should be suggested based on the content of this rule.",
      list: true,
    },
    {
      type: "string",
      name: "redirects",
      label: "Redirects",
      list: true,
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
      name: "seoDescription",
      label: "SEO Description",
      description:
        "A summary of the page content, used for SEO purposes. This can be generated automatically with AI.",
    },
    {
      type: "rich-text",
      name: "body",
      label: "Body",
      isBody: true,
      templates: embedTemplates,
      toolbarOverride: ['embed', 'heading', 'link', 'quote', 'ul', 'ol', 'bold', 'italic', 'code', 'codeBlock', 'mermaid', 'table', 'raw']
    },
    ...historyFields
  ],
};

export default Rule;
