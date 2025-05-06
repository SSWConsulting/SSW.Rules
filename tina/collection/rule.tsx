import React from 'react';
import { Collection } from "tinacms";

const Rule: Collection = {
    name: 'rule',
    label: 'Rule',
    path: 'content/rule',
    format: 'mdx',
    fields: [
        {
            type: 'string',
            label: 'Title',
            name: 'title',
            isTitle: true,
            required: true,
        },
        {
            label: 'Category',
            name: 'category',
            type: 'reference',
            collections: ['category'],
            ui:{
                optionComponent: (props: any) => {
                    if (props && props.title) {
                      return (
                        <div className="flex items-center text-base">
                          {props.title}
                        </div>
                      );
                    } else {
                      return <div>No Categories...</div>;
                    }
                  },
            },
            required:true
        },
        {
          type: 'rich-text',
          label: 'Rule Content',
          name: 'content',
          required: true,
        },
    ]
}

export default Rule;