'use client';

import React from 'react';
import { RiArrowRightCircleFill } from 'react-icons/ri';
import { Rule } from '@/types';
import RuleListItemHeader from './rule-list-item-header';
import { IconLink } from '@/components/ui';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import { tinaField } from 'tinacms/dist/react';
import MarkdownComponentMapping from '../tina-markdown/markdown-component-mapping';

export interface RuleListItemProps {
  rule: any;
  viewStyle: string;
  onBookmarkRemoved?: (ruleGuid: string) => void;
}

function collectIntroEmbeds(nodes: any[] = []): any[] {
  const out: any[] = [];
  for (const n of nodes) {
    if (n?.name === 'introEmbed') out.push(n);
    if (Array.isArray(n?.children)) out.push(...collectIntroEmbeds(n.children));
  }
  return out;
}

function makeBlurbContent(body?: any) {
  if (!body) return undefined;
  const children = Array.isArray(body?.children) ? body.children : [];
  const embeds = collectIntroEmbeds(children);
  return { type: 'root', children: embeds };
}

const RuleListItem: React.FC<RuleListItemProps> = ({ rule, viewStyle, type, onBookmarkRemoved }) => {
  const blurbContent = React.useMemo(() => makeBlurbContent(rule?.body), [rule?.body]);
  const hasBlurb =
    blurbContent &&
    Array.isArray(blurbContent.children) &&
    blurbContent.children.length > 0;

  return (
    <div className="mb-3">
      <li key={rule.guid}>
        <RuleListItemHeader
          rule={rule}
          showBookmark={true}
          onBookmarkRemoved={onBookmarkRemoved}
        />

        <section className={`p-4 ${viewStyle === 'blurb' ? 'visible' : 'hidden'}`}>
          {hasBlurb && (
            <div data-tina-field={tinaField(rule, 'body')} className="mt-8">
              <TinaMarkdown
                content={blurbContent}
                components={MarkdownComponentMapping}
              />
            </div>
          )}
          <IconLink
            href={`/${rule.uri}`}
            title={`Read more about ${rule.title}`}
            className="my-5"
          >
            <RiArrowRightCircleFill className="inline mr-1" />
            Read more
          </IconLink>
        </section>

        <section className={`rule-content px-4 mb-4 ${viewStyle === 'all' ? 'visible' : 'hidden'}`}>
          {rule?.body && (
            <div data-tina-field={tinaField(rule, 'body')} className="mt-8">
              <TinaMarkdown
                content={rule.body}
                components={MarkdownComponentMapping}
              />
            </div>
          )}
        </section>
      </li>
    </div>
  );
};

export default RuleListItem;
