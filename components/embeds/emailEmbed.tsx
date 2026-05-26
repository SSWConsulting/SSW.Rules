"use client";

import React, { RefObject, useRef } from "react";
import { Template } from "tinacms";
import { TinaMarkdown } from "tinacms/dist/rich-text";
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

  const figure: string = data?.figure || "";
  const figurePrefix: any = data?.figurePrefix || "default";

  return (
    <>
      <div className="bg-gray-100 p-6 rounded-md mt-4">
        <div className="space-y-3">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1 sm:flex-row sm:gap-0 sm:items-start sm:text-right">
              <div className="sm:w-24 sm:shrink-0 sm:pt-2 sm:pr-2">{label}:</div>
              <div className="sm:flex-1 sm:min-w-0">
                <div className="bg-white border px-3 py-2 rounded text-sm min-h-[40px] flex items-center text-left">{value}</div>
              </div>
            </div>
          ))}
        </div>

        {data.shouldDisplayBody && data.body && (
          <div className="mt-6 sm:pl-24">
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
