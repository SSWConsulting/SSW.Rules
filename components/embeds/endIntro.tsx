import React from "react";
import { Template } from "tinacms";

export function EndIntro() {
  return <></>;
}

export const endIntroTemplate: Template = {
  name: "endIntro",
  label: "End Intro",
  fields: [
    {
      type: "string",
      name: "_hidden",
      label: "hidden-field",
      description: "This field is hidden to satisfy GraphQL schema requirements.",
      ui: {
        component: () => null,
      },
      required: false,
    },
  ],
  ui: {
    defaultItem: {
      _hidden: "",
    },
  },
};

export const endIntroComponent = {
  endIntro: () => <EndIntro />,
};
