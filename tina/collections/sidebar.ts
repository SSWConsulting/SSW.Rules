import { Collection, Template } from "tinacms";
import { historyOfRulesBlock } from "../../src/components/side-bar/history-of-rules";
import { callToActionBlock } from "../../src/components/side-bar/call-to-action";

const ruleCountBlock = {
    label: 'Rule Count',
    name: 'ruleCount',
    ui: {
        defaultItem: {
            label: 'SSW Rules'
        },
        previewSrc: '/rules/blocks/rule-count.png'
    }, 
    fields: [
      {
        type: 'string',
        name: 'label',
        label: 'Label',
        required: true,
      },
    ],
  };

const latestRulesBlock: Template = {
    label: 'Latest Rules',
    name: 'latestRules',
    ui: {
        defaultItem: {
            label: 'Latest Rules'
        },
        previewSrc: '/rules/blocks/latest-rules.png'
    },
    fields: [
        {
            type: 'string',
            name: 'label',
            label: 'Label',
            required: true
        }
    ]
}

export const Sidebar: Collection = {
    label: 'Sidebar',
    name: 'sidebar',
    path: '/',
    format: 'json',
    match: {
        include: 'sidebar',
    },
    ui: {
        allowedActions: {
            create: false,
            delete: false,
        },
    },
    fields: [
        {
            type: 'object',
            list: true,
            name: 'blocks',
            label: 'Sidebar Blocks',
            ui: {
                visualSelector: true,
            },
            templates: [
                ruleCountBlock as Template,
                latestRulesBlock,
                historyOfRulesBlock,
                callToActionBlock
            ]
        }
    ]
};
