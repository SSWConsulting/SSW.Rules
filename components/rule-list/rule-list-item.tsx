"use client";

import React, { RefObject, useRef } from "react";
import { tinaField } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { useMarkHighlight } from "@/lib/useMarkHighlight";
import { RuleListFilter } from "@/types/ruleListFilter";
import MarkdownComponentMapping from "../tina-markdown/markdown-component-mapping";
import RuleListItemHeader from "./rule-list-item-header";

export interface RuleListItemProps {
  rule: any;
  index: number;
  filter: RuleListFilter;
  onBookmarkRemoved?: (ruleGuid: string) => void;
  currentSort?: string;
}

const RuleListItem: React.FC<RuleListItemProps> = ({ rule, index, filter, onBookmarkRemoved, currentSort }) => {
  function makeBlurbContent(body?: { children?: any[] }) {
    if (!body || !Array.isArray(body.children)) return;

    const index = body.children.findIndex((node) => node?.name === "endIntro");

    const blurbChildren = index === -1 ? body.children : body.children.slice(0, index);

    return {
      ...body,
      children: blurbChildren,
    };
  }

  function getContentForViewStyle(filter: RuleListFilter, body?: any) {
    if (!body) return undefined;
    if (filter === RuleListFilter.All) return body;
    if (filter === RuleListFilter.Blurb) return makeBlurbContent(body);
    return undefined;
  }

  const contentRef = useRef<HTMLDivElement>(null);
  useMarkHighlight(contentRef as RefObject<HTMLElement>, "ul li div");

  return (
    <li key={index} className="p-4 border rounded shadow">
      <RuleListItemHeader rule={rule} index={index} currentSort={currentSort} />

      {rule.isArchived && rule.archivedreason && (
        <div className="mx-2 my-4 md:mx-6 md:my-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <svg className="h-5 w-5 text-ssw-red" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-ssw-red m-0 mb-1">This rule has been archived</h3>
              <div className="text-sm text-ssw-red m-0">
                <span className="font-medium">Archived Reason:</span>{" "}
                <span
                  dangerouslySetInnerHTML={{
                    __html: rule.archivedreason
                      ?.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-ssw-red underline hover:opacity-80">$1</a>')
                      ?.replace(/https?:\/\/[^\s]+/g, '<a href="$&" class="text-ssw-red underline hover:opacity-80">$&</a>'),
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {filter !== RuleListFilter.TitleOnly && (
        <div data-tina-field={tinaField(rule, "body")} className="pt-4 pl-8 pr-2" ref={contentRef}>
          <TinaMarkdown content={getContentForViewStyle(filter, rule.body)} components={MarkdownComponentMapping} />
        </div>
      )}
    </li>
  );
};
export default RuleListItem;
