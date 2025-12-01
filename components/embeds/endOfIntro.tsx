import React from "react";
import { Template } from "tinacms";

export function EndOfIntro() {
  return <></>;
}

export const endOfIntroTemplate: Template = {
  name: "endOfIntro",
  label: "End Of Intro",
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

export const endOfIntroComponent = {
  endOfIntro: () => <EndOfIntro />,
};
