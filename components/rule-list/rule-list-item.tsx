'use client';

import React from 'react';
import RuleListItemHeader from './rule-list-item-header';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import { tinaField } from 'tinacms/dist/react';
import MarkdownComponentMapping from '../tina-markdown/markdown-component-mapping';
import { RuleListFilter } from '@/types/ruleListFilter';

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

    return (
        <li key={index} className='p-4 pt-5 border rounded shadow'>
            <RuleListItemHeader rule={rule} index={index} showBookmark={true} onBookmarkRemoved={onBookmarkRemoved}/>

            <div data-tina-field={tinaField(rule, 'body')} className='px-2 py-2 md:px-6 md:py-4'>
                <TinaMarkdown content={getContentForViewStyle(filter, rule.body)} components={MarkdownComponentMapping} />
            </div>
        </li>
    );
};
export default RuleListItem;
