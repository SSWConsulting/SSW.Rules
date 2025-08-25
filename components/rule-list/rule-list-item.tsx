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
  type: string;
  onBookmarkRemoved?: (ruleGuid: string) => void;
}

const RuleListItem: React.FC<RuleListItemProps> = ({ rule, viewStyle, type, onBookmarkRemoved }) => {

  return (
    <div className="mb-3">
      <li key={rule.guid}>
        <RuleListItemHeader 
          rule={rule} 
          type={type} 
          onBookmarkRemoved={onBookmarkRemoved}
        />
        
        <section className={`p-4 ${viewStyle === 'blurb' ? 'visible' : 'hidden'}`}>
          <div data-tina-field={tinaField(rule, "body")} className="mt-8">
            <TinaMarkdown
              content={rule?.body?.children?.slice(0, 2)}
              components={MarkdownComponentMapping}
            />
          </div>
          <IconLink href={`/${rule.uri}`}
              title={`Read more about ${rule.title}`}
              className="my-5">
              <RiArrowRightCircleFill className="inline mr-1" />
              Read more
          </IconLink>
        </section>
        
        <section className={`rule-content px-4 mb-4 ${viewStyle === 'all' ? 'visible' : 'hidden'}`}>
          <div data-tina-field={tinaField(rule, "body")} className="mt-8">
            <TinaMarkdown
              content={rule?.body}
              components={MarkdownComponentMapping}
            />
          </div>
        </section>
      </li>
    </div>
  );
};

export default RuleListItem;
