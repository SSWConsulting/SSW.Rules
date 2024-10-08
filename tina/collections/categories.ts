import { Collection } from 'tinacms';

export const Categories: Collection = {
    label: 'Categories',
    name: 'categories',
    path: '/categories',
    format: 'md',
    fields: [
      {
        type: 'string',
        name: 'type',
        label: 'Type',
        required: true,
      },
      {
        type: 'string',
        name: 'title',
        label: 'Title',
      },
      {
        type: 'string',
        name: 'uri', 
        label: 'Uri',
      }
    ],
}