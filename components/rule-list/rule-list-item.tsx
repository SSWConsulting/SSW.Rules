'use client';

import React, { useRef } from 'react';
import RuleListItemHeader from './rule-list-item-header';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import { tinaField } from 'tinacms/dist/react';
import MarkdownComponentMapping from '../tina-markdown/markdown-component-mapping';
import { RuleListFilter } from '@/types/ruleListFilter';
import { useMarkHighlight } from '@/lib/useMarkHighlight';

export interface RuleListItemProps {
  rule: any;
  index: number;
  filter: RuleListFilter;
  onBookmarkRemoved?: (ruleGuid: string) => void;
}

const RuleListItem: React.FC<RuleListItemProps> = ({ rule, index, filter, onBookmarkRemoved }) => {
  function collectIntroEmbeds(nodes: any[] = []): any[] {
    const out: any[] = [];
    for (const n of nodes) {
      if (n?.name === 'introEmbed') out.push(n);
      if (Array.isArray(n?.children)) out.push(...collectIntroEmbeds(n.children));
    }
    return out;
  }

  function makeBlurbContent(body?: any) {
    const children = Array.isArray(body?.children) ? body.children : [];
    const embeds = collectIntroEmbeds(children);
    return { type: 'root', children: embeds };
  }

  function getContentForViewStyle(filter: RuleListFilter, body?: any) {
    if (!body) return undefined;
    if (filter === RuleListFilter.All) return body;
    if (filter === RuleListFilter.Blurb) return makeBlurbContent(body);
    return undefined;
  }

  const contentRef = useRef<HTMLDivElement>(null);
  useMarkHighlight(contentRef, "ul li div");

  return (
    <li key={index} className="p-4 border rounded shadow">
      <RuleListItemHeader rule={rule} index={index} showBookmark={true} onBookmarkRemoved={onBookmarkRemoved} />

      {rule.isArchived && rule.archivedreason && (
        <div className="mx-2 my-4 md:mx-6 md:my-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-[var(--ssw-red)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[var(--ssw-red)] m-0 mb-1">
                This rule has been archived
              </h3>
              <div className="text-sm text-[var(--ssw-red)] m-0">
                <span className="font-medium">Archived Reason:</span>{' '}
                <span 
                  dangerouslySetInnerHTML={{
                    __html: rule.archivedreason
                      ?.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[var(--ssw-red)] underline hover:opacity-80">$1</a>')
                      ?.replace(/https?:\/\/[^\s]+/g, '<a href="$&" class="text-[var(--ssw-red)] underline hover:opacity-80">$&</a>')
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {filter !== RuleListFilter.TitleOnly && (
        <div data-tina-field={tinaField(rule, 'body')} className="pt-4 px-6" ref={contentRef}>
          <TinaMarkdown content={getContentForViewStyle(filter, rule.body)} components={MarkdownComponentMapping} />
        </div>
      )}
    </li>
  );
};
export default RuleListItem;
