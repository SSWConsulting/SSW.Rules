import type { Collection } from "tinacms";

const Homepage: Collection = {
  label: "Homepage",
  name: "homepage",
  path: "homepage",
  format: "json",
  ui: {
    allowedActions: {
      create: false,
      delete: false,
    },
  },
  fields: [
    {
      type: "string",
      name: "tagline",
      label: "Tagline",
    },
    {
      type: "object",
      name: "aboutSsw",
      label: "About SSW",
      fields: [
        { type: "string", name: "title", label: "Title" },
        {
          type: "string",
          name: "body",
          label: "Body",
          ui: { component: "textarea" },
        },
      ],
    },
    {
      type: "object",
      name: "needHelp",
      label: "Need Help",
      fields: [
        { type: "string", name: "title", label: "Title" },
        {
          type: "string",
          name: "description",
          label: "Description",
          ui: { component: "textarea" },
        },
        { type: "string", name: "buttonText", label: "Button Text" },
        { type: "string", name: "jotFormId", label: "JotForm ID" },
      ],
    },
    {
      type: "object",
      name: "helpImprove",
      label: "Help Improve Our Rules",
      fields: [
        { type: "string", name: "title", label: "Title" },
        {
          type: "string",
          name: "quote",
          label: "Quote",
          ui: { component: "textarea" },
        },
        { type: "string", name: "tweetUrl", label: "Tweet URL" },
        { type: "string", name: "personName", label: "Person Name" },
        { type: "string", name: "personTitle", label: "Person Title" },
        { type: "string", name: "personImage", label: "Person Image URL" },
        { type: "string", name: "personProfileUrl", label: "Person Profile URL" },
      ],
    },
    {
      type: "object",
      name: "whyRules",
      label: "Why All These Rules?",
      fields: [
        { type: "string", name: "title", label: "Title" },
        { type: "string", name: "linkText", label: "Link Text" },
        { type: "string", name: "linkUrl", label: "Link URL" },
        { type: "string", name: "description", label: "Description" },
      ],
    },
    {
      type: "object",
      name: "joinConversation",
      label: "Join the Conversation",
      fields: [
        { type: "string", name: "hashtag", label: "Hashtag" },
        { type: "string", name: "platformUrl", label: "Platform URL" },
      ],
    },
    {
      type: "object",
      name: "quickLinks",
      label: "Quick Links",
      fields: [
        {
          type: "object",
          list: true,
          name: "links",
          label: "Links",
          ui: {
            itemProps: (item) => ({ label: item?.linkText || "undefined" }),
          },
          fields: [
            { type: "string", name: "linkText", label: "Link Text" },
            { type: "string", name: "uri", label: "URI" },
          ],
        },
      ],
    },
  ],
};

export default Homepage;
