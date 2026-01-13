"use client";

import React, { RefObject, useRef } from "react";
import { Template } from "tinacms";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { useMarkHighlight } from "@/lib/useMarkHighlight";
import MarkdownComponentMapping from "../tina-markdown/markdown-component-mapping";
import { Figure, inlineFigureDefaultItem, inlineFigureFields } from "./figure";

export function EmailEmbed({ data }: { data: any }) {
  const fields = [
    { label: "From", value: data.from },
    { label: "To", value: data.to },
    { label: "Cc", value: data.cc },
    { label: "Bcc", value: data.bcc },
    { label: "Subject", value: data.subject },
  ].filter((field) => field.value?.trim());

  const contentRef = useRef<HTMLDivElement>(null);
  useMarkHighlight(contentRef as RefObject<HTMLElement>);

  const figure: string = data?.figure || "";
  const figurePrefix: any = data?.figurePrefix || "default";

  return (
    <>
      <div className="bg-gray-100 p-6 rounded-md mt-4">
        <div className="space-y-3">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex items-start text-right">
              <div className="w-24 pt-2 pr-2">{label}:</div>
              <div className="flex-1">
                <div className="bg-white border px-3 py-2 rounded text-sm min-h-[40px] flex items-center">{value}</div>
              </div>
            </div>
          ))}
        </div>

        {data.shouldDisplayBody && data.body && (
          <div className="mt-6 pl-24">
            <div className="bg-white border p-4 rounded">
              <div ref={contentRef}>
                <TinaMarkdown content={data.body} components={MarkdownComponentMapping} />
              </div>
            </div>
          </div>
        )}
      </div>
      <Figure prefix={figurePrefix} text={figure} className="mt-2" />
    </>
  );
}

export const emailEmbedTemplate: Template = {
  name: "emailEmbed",
  label: "Email Template",
  ui: {
    defaultItem: {
      from: "XXX",
      to: "XXX",
      cc: "YYY",
      bcc: "ZZZ",
      subject: "Email Subject",
      shouldDisplayBody: true,
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
      ...inlineFigureDefaultItem,
    },
  },
  fields: [
    { name: "from", label: "From", type: "string" },
    { name: "to", label: "To", type: "string" },
    { name: "cc", label: "Cc", type: "string" },
    { name: "bcc", label: "Bcc", type: "string" },
    { name: "subject", label: "Subject", type: "string" },
    { name: "shouldDisplayBody", label: "Display Body?", type: "boolean" },
    { name: "body", label: "Body", type: "rich-text" },
    ...(inlineFigureFields as any),
  ],
};

export const emailEmbedComponent = {
  emailEmbed: (props: any) => <EmailEmbed data={props} />,
};
