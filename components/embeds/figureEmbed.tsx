import { Template } from "tinacms";
import React from "react";

export interface FigureEmbedProps {
  preset: string;
  figure: string;
  shouldDisplay: boolean;
}

export function FigureEmbed({ data }: { data: FigureEmbedProps }) {
  const { preset, figure, shouldDisplay } = data;

  let prefix = "";
  switch (preset) {
    case "default":
      prefix = "Figure - ";
      break;
    case "badExample":
      prefix = "❌ Figure: Bad example - ";
      break;
    case "goodExample":
      prefix = "✅ Figure: Good example - ";
      break;
    default:
      break;
  }

  return (
    <p className={`font-bold ${shouldDisplay ? "" : "hidden"}`}>
      {prefix}
      {figure}
    </p>
  );
}

export const figureEmbedFields = {
  name: "figureEmbed",
  label: "Figure",
  type: "object",
  fields: [
    {
      name: "preset",
      label: "Preset",
      type: "string",
      required: true,
      options: [
        {
          value: "default",
          label: "Default",
        },
        {
          value: "badExample",
          label: "Bad Example",
        },
        {
          value: "goodExample",
          label: "Good Example",
        },
      ],
    },
    { name: "figure", label: "Figure", type: "string", required: true },
    { name: "shouldDisplay", label: "Display Figure?", type: "boolean" },
  ],
};

export const figureEmbedFieldsDefaultValue = {
  preset: "default",
  figure: "XXX",
  shouldDisplay: true,
};

export const figureEmbedTemplate: Template = {
  name: "figureEmbed",
  label: "Figure",
  ui: {
    defaultItem: figureEmbedFieldsDefaultValue,
  },
  fields: [figureEmbedFields as any],
};

export const figureEmbedComponent = {
  figureEmbed: (props: any) => <FigureEmbed data={props} />,
};
