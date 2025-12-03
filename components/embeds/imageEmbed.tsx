import Image from "next/image";
import React from "react";
import { Template } from "tinacms";
import { ComponentWithFigure, withFigureEmbedTemplateFields } from "./componentWithFigure";

const normalizeSrc = (input?: string) => {
  if (!input) return "";

  const tinaPrefix = "https://assets.tina.io/";
  if (!input.startsWith(tinaPrefix)) return input;

  const secondUrlStart = ["https://", "http://"].map((scheme) => input.indexOf(scheme, tinaPrefix.length)).filter((i) => i !== -1);

  if (secondUrlStart.length === 0) return input;

  const secondUrlIndex = Math.min(...secondUrlStart);
  return input.slice(secondUrlIndex);
};

export function ImageEmbed({ data }: { data: any }) {
  const src = normalizeSrc(data.src);

  const sizeClasses = {
    small: "max-w-xs",
    medium: "max-w-xl",
    large: "max-w-full",
  };

  const borderClass = data.showBorder ? "border-[10px] border-transparent" : "";
  const heightClass = data?.src?.trim() ? "h-auto" : "h-[300px]";

  return (
    <ComponentWithFigure data={data}>
      <div className={`bg-gray-200 mt-4 w-auto ${sizeClasses[data.size]} ${borderClass} ${heightClass}`}>
        {data?.src?.trim() && (
          <>
            <div className="border border-gray-200">
              <Image src={src} alt={data.alt} width={0} height={0} sizes="100vw" placeholder="empty" className="w-full h-auto" unoptimized />
            </div>
          </>
        )}
      </div>
    </ComponentWithFigure>
  );
}

export const imageEmbedTemplate: Template = withFigureEmbedTemplateFields({
  name: "imageEmbed",
  label: "Image",
  ui: {
    defaultItem: {
      alt: "Image",
      size: "small",
      showBorder: false,
    },
  },
  fields: [
    {
      name: "src",
      label: "Src",
      type: "image",
      required: true,
      uploadDir: (file) => {
        return `rules/${file.uri || ""}`;
      },
    },
    { name: "alt", label: "Alt", type: "string" },
    {
      name: "size",
      label: "Size",
      type: "string",
      required: true,
      options: [
        {
          value: "small",
          label: "Small",
        },
        {
          value: "medium",
          label: "Medium",
        },
        {
          value: "large",
          label: "Large",
        },
      ],
    },
    {
      name: "showBorder",
      label: "Show Border?",
      type: "boolean",
    },
  ],
});

export const imageEmbedComponent = {
  imageEmbed: (props: any) => <ImageEmbed data={props} />,
};
