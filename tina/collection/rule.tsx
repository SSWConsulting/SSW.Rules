import React from "react";
import { Collection, wrapFieldsWithMeta } from "tinacms";
import { embedTemplates } from "@/components/embeds";
import { generateGuid } from "@/utils/guidGenerationUtils";
import { CategorySelectorInput } from "../fields/CategorySelector";
import { PaginatedRuleSelectorInput } from "../fields/paginatedRuleSelector";
import { ReadonlyUriInput } from "../fields/ReadonlyUriInput";
import { historyBeforeSubmit, historyFields } from "./shared/historyFields";

const Rule: Collection = {
  name: "rule",
  label: "Rule",
  path: "public/uploads/rules",
  format: "mdx",
  match: {
    include: "**/rule",
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
      const slug = document?._sys?.relativePath?.split("/")?.[0] ?? "";
      return `/${slug}`;
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
      searchable: true,
    },
    {
      type: "string",
      name: "uri",
      label: "Uri",
      description: "The URI of the rule - this defines the slug and references.",
      required: true,
      searchable: true,
      ui: {
        component: wrapFieldsWithMeta((props) => <ReadonlyUriInput {...props} />),
        validate: (value: any) => {
          const v = (typeof value === "string" ? value : "").trim();
          if (!v) return "URI is required";
          if (/[A-Z]/.test(v)) return "URI cannot contain uppercase letters";
          if (/\s/.test(v)) return "URI cannot contain spaces";
        },
      },
    },
    {
      type: "object",
      name: "categories",
      label: "Categories",
      description: "Assigns one or more categories to the rule",
      list: true,
      searchable: false,
      ui: {
        itemProps: (item) => {
          const categoryTitle = item?.category ? `🔗 ${item?.category?.split("/").at(-1)?.replace(".mdx", "")}` : "Unselected Category";
          return { label: categoryTitle };
        },
      },
      fields: [
        {
          type: "reference",
          name: "category",
          label: "Related Category",
          description: "The related category of the rule",
          collections: ["category"],
          ui: {
            component: wrapFieldsWithMeta((props) => <CategorySelectorInput {...props} />),
          },
        },
      ],
    },
    {
      type: "object",
      name: "authors",
      label: "Authors",
      description: "The list of contributors for this rule.",
      list: true,
      searchable: false,
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
          description: "The full name of the contributor, as it should appear on the rule.",
          label: "Name",
        },
        {
          type: "string",
          description: "The SSW People link for the contributor - e.g. https://ssw.com.au/people/bob-northwind",
          name: "url",
          label: "Url",
        },
      ],
    },
    {
      type: "object",
      label: "Related Rules",
      name: "related",
      description: "The URIs of rules that should be suggested based on the content of this rule.",
      list: true,
      searchable: false,
      ui: {
        itemProps: (item) => ({
          label: item.rule?.split("/").at(-2) || "Rule is not selected",
        }),
      },
      fields: [
        {
          type: "reference",
          label: "Rule",
          name: "rule",
          description: "This rule list may not include newly created rules for up to one hour. It is updated based on the main branch after that time.",
          collections: ["rule"],
          ui: {
            component: PaginatedRuleSelectorInput,
          },
        },
      ],
    },
    {
      type: "string",
      name: "redirects",
      label: "URI Redirects",
      description: "Other URIs which will redirect to this rule.",
      list: true,
      searchable: false,
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
      name: "seoDescription",
      label: "SEO Description",
      description: "A summary of the page content, used for SEO purposes. This can be generated automatically with AI.",
      searchable: false,
    },
    {
      type: "rich-text",
      name: "body",
      label: "Body",
      isBody: true,
      searchable: false,
      templates: embedTemplates,
      toolbarOverride: ["embed", "heading", "link", "quote", "ul", "ol", "bold", "italic", "code", "codeBlock", "mermaid", "table", "raw"],
    },
    {
      type: "image",
      label: "Rule thumbnail",
      name: "thumbnail",
      description: "Use a JPG or PNG image that is at least 175 x 175px",
      // @ts-expect-error tinacms types are wrong
      uploadDir: (file) => {
        return `rules/${file.uri || ""}`;
      },
    },
    ...historyFields,
  ],
};

export default Rule;
