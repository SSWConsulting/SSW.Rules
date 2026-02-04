import React from "react";
import { Collection, useCMS, wrapFieldsWithMeta } from "tinacms";
import { embedTemplates } from "@/components/embeds";
import { generateGuid } from "@/utils/guidGenerationUtils";
import { countEndIntro } from "@/utils/mdxNodeUtils";
import { CategorySelectorInput } from "../fields/CategorySelector";
import { ConditionalHiddenField } from "../fields/ConditionalHiddenField";
import { ReadonlyUriInput } from "../fields/ReadonlyUriInput";
import { RuleSelector } from "../fields/RuleSelector";
import { createdInfoFields } from "./shared/createdInfoFields";
import { historyBeforeSubmit, historyFields } from "./shared/historyFields";
import { toolbarFields } from "./shared/toolbarFields";

const Rule: Collection = {
  name: "rule",
  label: "Rules",
  path: "public/uploads/rules",
  format: "mdx",
  match: {
    include: "**/rule",
  },
  defaultItem() {
    // User info will be set by UserInfoField component after form initialization
    return {
      guid: generateGuid(),
      created: new Date().toISOString(),
      createdBy: "Unknown",
      createdByEmail: "Unknown",
      filename: "rule",
      body: defaultBody,
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
      description:
        "The title should start with \"Do you\" and end with a question mark.",
      isTitle: true,
      required: true,
      searchable: true,
    },
    {
      type: "string",
      name: "uri",
      label: "Slug",
      description: "The slug for the rule e.g. keep-your-urls-clean",
      required: true,
      searchable: true,
      ui: {
        component: wrapFieldsWithMeta((props) => <ReadonlyUriInput {...props} />),
        validate: (value: any) => {
          const v = (typeof value === "string" ? value : "").trim();
          if (!v) return "Slug is required";
          if (/[A-Z]/.test(v)) return "Slug cannot contain uppercase letters";
          if (/\s/.test(v)) return "Slug cannot contain spaces";
        },
      },
    },
    {
      type: "object",
      name: "categories",
      label: "Categories",
      description: "Assigns one or more categories to the rule.",
      list: true,
      searchable: false,
      ui: {
        itemProps: (item) => ({ label: item?.category ? `📂 ${item?.category?.split("/").at(-1)?.replace(".mdx", "")}` : "Select a Category" }),
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
      type: "string",
      name: "sidebarVideo",
      label: "Sidebar Video",
      description: "Add Sidebar Video here. e.g. YouTube Shorts",
      searchable: false,
      ui: {
        component: ConditionalHiddenField,
      },
    },
    {
      type: "object",
      name: "authors",
      label: "Authors",
      description: "The list of contributors for this rule.",
      list: true,
      searchable: false,
      ui: {
        itemProps: (item) => ({ label: "👤 " + (item?.title ?? "Author") }),
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
      description: "URIs of related rules to suggest.",
      list: true,
      searchable: false,
      ui: {
        itemProps: (item) => ({
          label: item.rule?.split("/").at(-2) || "Select a Related Rule",
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
            component: RuleSelector,
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
        validate: (value: any) => {
          const count = countEndIntro(value);
          if (count !== 1) {
            const error =
              count === 0
                ? "Please add an EndIntro embed component to separate the intro and body content."
                : "There are multiple EndIntro embed components in this rule. Please keep only one.";

            return error;
          }
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
    ...createdInfoFields,
    ...historyFields,
  ],
};

const defaultBody = {
  type: "root",
  children: [
    {
      type: "p",
      children: [
        {
          type: "text",
          text: "Intro",
        },
      ],
    },
    {
      type: "mdxJsxFlowElement",
      name: "endIntro",
      children: [
        {
          type: "text",
          text: "",
        },
      ],
      props: {},
    },
    {
      children: [
        {
          text: "Body",
        },
      ],
      type: "p",
    },
  ],
};

export default Rule;
