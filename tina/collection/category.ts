import { Collection } from "tinacms";

const Category: Collection = {
    name: 'category',
    label: 'Category',
    path: 'content/category',
    format: 'md',
    fields: [
        {
            type: 'string',
            label: 'Title',
            name: 'title',
            isTitle: true,
            required: true,
        }
    ],
}

export default Category;