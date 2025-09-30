import React from "react";
import { Template } from "tinacms";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { typographyComponents } from "@/components/typography-components";
import { YouTubePlayer } from "../shared/Youtube";
import { AsideEmbed, asideEmbedTemplate } from "./asideEmbed";

const IntroInnerMarkdownComponents = {
  ...typographyComponents,
  introYoutube: (props: any) => (
    <YouTubePlayer url={props?.url ?? ""} description={props?.description ?? ""} />
  ),
  asideEmbed: (props: any) => <AsideEmbed data={props} />,
};

export function IntroEmbed({ body }: { body: any }) {
  const content =
    body && body.type === "root"
      ? body
      : { type: "root", children: Array.isArray(body) ? body : [] };

  if (!Array.isArray(content.children) || !content.children.length) return null;

  return (
    <section>
      <div>
        <TinaMarkdown content={content} components={IntroInnerMarkdownComponents as any} />
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
