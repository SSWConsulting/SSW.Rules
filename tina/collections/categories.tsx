import { Collection, MdxFieldPlugin } from 'tinacms';
import React from 'react'

export const Categories: Collection = {
    label: 'Categories',
    name: 'categories',
    path: '/categories',
    format: 'md',
    defaultItem: () => {
      return {
        guid: generateGuid(),
        filename: 'index',
        type: 'category',
      }
    },
    ui: {
      filename: {
        readonly: true,
      },
      beforeSubmit: async (arg) =>{

        return arg.values;
      }
    },
    fields: [
      {
        type: 'string',
        name: 'type',
        label: 'Type',
        required: true,
        ui: {
          component: 'select',
          options: ['category', 'top-category'],
        }
      },
      {
        type: 'string',
        name: 'title',
        label: 'Title',
        description: 'The name (heading) of the category.',
      },
      {
        type: 'string',
        name: 'uri', 
        label: 'Uri',
        description: 'This is the slug and identifier associated to the category.',
      },
      {
        type: 'string',
        name: 'guid',
        label: 'Guid',
        description: 'If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).',
        // ui: {
        //   component: 'hidden',
  
        // }
      },
      {
        type: 'string',
        name: 'index',
        label: 'Index',
        description: 'The list of URIs for the rules to be included in this category.',
      },
      {
        type: 'rich-text',
        name: 'body',
        label: 'Body',
        isBody: true,
        description: 'The content that proceeds rules for this category. Only applicable to regular categories (not top categories).',
        ui: {
          component: (props) => {
            return <div className="mb-4 relative">
                    <div className="z-50 absolute cursor-not-allowed w-full h-full top-0 left-0"/>
                      <div className="opacity-50">
                {MdxFieldPlugin.Component(props)}
              </div>
            </div>
          }
        }
      }
    ],

}
