import React from "react";
import { Collection, wrapFieldsWithMeta } from "tinacms";
import { embedTemplates } from "@/components/embeds";
import { generateGuid } from "@/utils/guidGenerationUtils";
import { countEndOfIntro, removeEndOfIntroHiddenProp } from "@/utils/mdxNodeUtils";
import { CategorySelectorInput } from "../fields/CategorySelector";
import { ConditionalHiddenField } from "../fields/ConditionalHiddenField";
import { PaginatedRuleSelectorInput } from "../fields/paginatedRuleSelector";
import { ReadonlyUriInput } from "../fields/ReadonlyUriInput";
import { historyBeforeSubmit, historyFields } from "./shared/historyFields";
import { toolbarFields } from "./shared/toolbarFields";

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
    beforeSubmit: async (props) => {
      const result = await historyBeforeSubmit(props);
      const values = (result ?? props.values) as any;

      const count = countEndOfIntro(values.body);

      if (count !== 1) {
        const msg =
          count === 0
            ? "This rule is missing an <endOfIntro /> marker. Please add one to separate the introduction from the rest of the content."
            : "There are multiple <endOfIntro /> markers in this rule. Please keep only one.";

        props.cms.alerts?.error?.(msg);
        throw new Error("Body must contain exactly one <endOfIntro /> component.");
      }

      return values;
    },
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
        component: ConditionalHiddenField,
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
        component: ConditionalHiddenField,
      },
      fields: [
        {
          type: "string",
          name: "title",
          description: "The full name of the contributor, as it should appear on the rule.",
          label: "Name",
          ui: {
            component: ConditionalHiddenField,
          },
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
        component: ConditionalHiddenField,
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
      ui: {
        component: ConditionalHiddenField,
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
      name: "seoDescription",
      label: "SEO Description",
      description:
        "A summary of the page content, used for SEO purposes. This can be generated automatically with AI - See https://www.ssw.com.au/rules/html-meta-tags/#rectifying-the-missing-meta-tags-issue",
      searchable: false,
      ui: {
        component: ConditionalHiddenField,
      },
    },
    {
      type: "rich-text",
      name: "body",
      label: "Body",
      isBody: true,
      searchable: false,
      templates: embedTemplates,
      toolbarOverride: toolbarFields,
      ui: {
        component: ConditionalHiddenField,
        parse: (value: any) => {
          return removeEndOfIntroHiddenProp(value);
        },
      },
    },
    {
      type: "image",
      label: "Rule thumbnail",
      name: "thumbnail",
      description: "Use a JPG or PNG image that is at least 175 x 175px",
      uploadDir: (file) => {
        return `rules/${file.uri || ""}`;
      },
      ui: {
        component: ConditionalHiddenField,
      },
    },
    ...historyFields,
  ],
};

export default Rule;
