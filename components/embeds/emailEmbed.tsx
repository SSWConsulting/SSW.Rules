import { Template } from "tinacms";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import React, { useRef } from "react";
import {
  ComponentWithFigure,
  withFigureEmbedTemplateFields,
} from "./componentWithFigure";
import MarkdownComponentMapping from "../tina-markdown/markdown-component-mapping";
import { useMarkHighlight } from "@/lib/useMarkHighlight";

export function EmailEmbed({ data }: { data: any }) {
  const fields = [
    { label: "From", value: data.from },
    { label: "To", value: data.to },
    { label: "Cc", value: data.cc },
    { label: "Bcc", value: data.bcc },
    { label: "Subject", value: data.subject },
  ].filter((field) => field.value?.trim());

  const contentRef = useRef<HTMLDivElement>(null);
  useMarkHighlight(contentRef, "ol li div");

  return (
    <ComponentWithFigure data={data}>
      <div className="bg-gray-100 p-6 rounded-md mt-4">
        <div className="space-y-3">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex items-start text-right">
              <div className="w-24 pt-2 pr-2">{label}:</div>
              <div className="flex-1">
                <div className="bg-white border px-3 py-2 rounded text-sm min-h-[40px] flex items-center">
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pl-24">
          <div className="bg-white border p-4 rounded">
            <div className="prose prose-sm" ref={contentRef}>
              <TinaMarkdown content={data.body} components={MarkdownComponentMapping} />
            </div>
          </div>
        </div>
      </div>
    </ComponentWithFigure>
  );
}

export const emailEmbedTemplate: Template = withFigureEmbedTemplateFields({
  name: "emailEmbed",
  label: "Email",
  ui: {
    defaultItem: {
      from: "XXX",
      to: "XXX",
      cc: "YYY",
      bcc: "ZZZ",
      subject: "Email Subject",
      body: {
        type: "root",
        children: [
          {
            type: "h2",
            children: [{ text: "Hi XXX" }],
          },
          {
            type: "p",
            children: [{ text: "EMAIL CONTENT" }],
          },
        ],
      },
    },
  },
  fields: [
    { name: "from", label: "From", type: "string" },
    { name: "to", label: "To", type: "string" },
    { name: "cc", label: "Cc", type: "string" },
    { name: "bcc", label: "Bcc", type: "string" },
    { name: "subject", label: "Subject", type: "string" },
    { name: "body", label: "Body", type: "rich-text" },
  ],
});

export const emailEmbedComponent = {
  emailEmbed: (props: any) => <EmailEmbed data={props} />,
};
