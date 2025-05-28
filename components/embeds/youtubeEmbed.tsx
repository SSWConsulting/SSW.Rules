import { Template } from "tinacms";
import React from "react";

export function YoutubeEmbed({ data }: { data: any }) {
  const extractYoutubeId = (url: string): string | null => {

    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }

    const match = url.match(
      /(?:youtube\.com\/.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : null;
  };

  const videoId = extractYoutubeId(data.url || "");

  if (!videoId) {
    return <div className="text-red-600">Invalid YouTube URL</div>;
  }

  return (
    <div>
      <div className="my-4 space-y-2">
      <div className="relative w-full aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute top-0 left-0 w-full h-full border-0"
          />
        </div>
        <div className="text-base font-bold">
            {data.description}
        </div>
      </div>
    </div>
  );
}

export const youtubeEmbedTemplate: Template = ({
    name: "youtubeEmbed",
    label: "YouTube",

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
});

export const youtubeEmbedComponents = {
    youtubeEmbed: (props: any) => <YoutubeEmbed data={props} />,
};