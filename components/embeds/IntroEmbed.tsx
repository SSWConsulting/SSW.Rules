import React from "react";
import { Template } from "tinacms";
import { tinaField } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { getTypographyComponents } from "@/components/typography-components";
import { YouTubePlayer } from "../shared/Youtube";
import { AsideEmbed, asideEmbedTemplate } from "./asideEmbed";
import { toolbarFields } from "@/tina/collection/shared/toolbarFields";

const IntroInnerMarkdownComponents = {
  ...getTypographyComponents(false),
  introYoutube: (props: any) => <YouTubePlayer url={props?.url ?? ""} description={props?.description ?? ""} />,
  asideEmbed: (props: any) => <AsideEmbed {...props} />,
};

export function IntroEmbed(props: any) {
  const { body } = props;
  const content = body && body.type === "root" ? body : { type: "root", children: Array.isArray(body) ? body : [] };

  if (!Array.isArray(content.children) || !content.children.length) return null;

  return (
    <section>
      <div data-tina-field={tinaField(props, "body")}>
        <TinaMarkdown content={props.body} components={IntroInnerMarkdownComponents as any} />
      </div>
    </section>
  );
}

const introYoutubeTemplate: Template = {
  name: "introYoutube",
  label: "YouTube",
  ui: { defaultItem: { url: "", description: "" } },
  fields: [
    { name: "url", label: "Video URL/ID", type: "string" },
    { name: "description", label: "Description", type: "string" },
  ],
};

export const introEmbedTemplate: Template = {
  name: "introEmbed",
  label: "Introduction",
  fields: [
    {
      name: "body",
      label: "Body",
      type: "rich-text",
      toolbarOverride: toolbarFields,
      templates: [introYoutubeTemplate, asideEmbedTemplate],
    },
  ],
  ui: {
    defaultItem: {
      body: {
        type: "root",
        children: [{ type: "p", children: [{ text: "Write an introduction…" }] }],
      },
    },
  },
};

export const introEmbedComponent = {
  introEmbed: (props: any) => <IntroEmbed {...props} />,
};
