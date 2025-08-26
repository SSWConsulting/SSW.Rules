"use client";

import React, { useState } from "react";
import { useTina } from "tinacms/dist/react";
import Link from "next/link";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import MarkdownComponentMapping from "@/components/tina-markdown/markdown-component-mapping";

import RadioButton from "@/components/radio-button";
import { RiFileTextFill, RiBookOpenFill, RiDoubleQuotesL } from "react-icons/ri";

export interface ClientCategoryPageProps {
  categoryQueryProps: {
    query: string;
    variables?: Record<string, any>;
    data?: any;
  };
}

function collectIntroEmbeds(nodes: any[] = []): any[] {
  const out: any[] = [];
  for (const n of nodes) {
    if (n?.name === "introEmbed") out.push(n);
    if (Array.isArray(n?.children)) out.push(...collectIntroEmbeds(n.children));
  }
  return out;
}

function makeBlurbContent(body?: any) {
  const children = Array.isArray(body?.children) ? body.children : [];
  const embeds = collectIntroEmbeds(children);
  return { type: "root", children: embeds };
}

function getContentForViewStyle(
  viewStyle: "titleOnly" | "blurb" | "all",
  body?: any
) {
  if (!body) return undefined;
  if (viewStyle === "all") return body;
  if (viewStyle === "blurb") return makeBlurbContent(body);
  return undefined;
}

export default function ClientCategoryPage(props: ClientCategoryPageProps) {
  const { categoryQueryProps } = props;

  const categoryData = useTina({
    query: categoryQueryProps?.query,
    variables: categoryQueryProps?.variables,
    data: categoryQueryProps?.data,
  }).data;

  const category = categoryData;

  const [viewStyle, setViewStyle] = useState<"titleOnly" | "blurb" | "all">(
    "all"
  );
  const iconSize = 24;

  const handleOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setViewStyle(e.target.value as "titleOnly" | "blurb" | "all");
  };

  return (
    <>
      <h1 className="font-bold mb-4">{category?.title}</h1>

      <div className="mb-6 flex justify-center gap-8 border-b border-solid border-b-gray-100 p-4 text-center">
        <RadioButton
          id="category-view-titleOnly"
          name="category-view"
          value="titleOnly"
          selectedOption={viewStyle}
          handleOptionChange={handleOptionChange}
          labelText="View titles only"
          icon={<RiDoubleQuotesL size={iconSize} />}
        />
        <RadioButton
          id="category-view-blurb"
          name="category-view"
          value="blurb"
          selectedOption={viewStyle}
          handleOptionChange={handleOptionChange}
          labelText="Show blurb"
          icon={<RiFileTextFill size={iconSize} />}
        />
        <RadioButton
          id="category-view-all"
          name="category-view"
          value="all"
          selectedOption={viewStyle}
          handleOptionChange={handleOptionChange}
          labelText="Gimme everything!"
          icon={<RiBookOpenFill size={iconSize} />}
        />
      </div>

      <ul className="space-y-8">
        {Array.isArray(category?.index) &&
          category.index.map((x: any) => {
            const uri = x?.rule?.uri;
            const title = x?.rule?.title;
            const body = x?.rule?.body;

            const content = getContentForViewStyle(viewStyle, body);
            const shouldShowBody =
              viewStyle !== "titleOnly" &&
              content &&
              Array.isArray(content?.children) &&
              content.children.length > 0;

            return (
              <li key={uri}>
                <Link href={`/${uri}`} className="underline underline-offset-4">
                  <h2 className="font-medium">{title}</h2>
                </Link>

                {shouldShowBody && (
                  <div className="mt-4 prose max-w-none">
                    <TinaMarkdown
                      content={content}
                      components={MarkdownComponentMapping}
                    />
                  </div>
                )}
              </li>
            );
          })}
      </ul>
    </>
  );
}
