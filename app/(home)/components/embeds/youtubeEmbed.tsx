import React from "react";
import { Template } from "tinacms";
import { YouTubePlayer } from "../shared/Youtube";

export function YoutubeEmbed({ data }: { data: any }) {
  return <YouTubePlayer url={data?.url || ""} description={data?.description || ""} />;
}

export const youtubeEmbedTemplate: Template = {
  name: "youtubeEmbed",
  label: "YouTube Video",

  fields: [
    {
      name: "url",
      label: "Video URL/ID",
      type: "string",
    },
    {
      name: "description",
      label: "description",
      type: "string",
    },
  ],
};

export const youtubeEmbedComponent = {
  youtubeEmbed: (props: any) => <YoutubeEmbed data={props} />,
};
