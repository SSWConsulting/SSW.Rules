import { generateGuid } from '../helpers/generateGuid';

var configJson = {
  config: {
    backend: {
      name: 'github',
      repo: 'SSWConsulting/SSW.Rules.Content',
      branch: process.env.CONTENT_BRANCH,
      open_authoring: true,
      auth_endpoint: '/api/auth',
      always_fork: true,
      base_url: process.env.API_BASE_URL,
      use_graphql: true,
    },
    site_url: 'https://www.ssw.com.au/rules',
    publish_mode: 'editorial_workflow',
    logo_url:
      'https://www.ssw.com.au/ssw/logo/SSWRules/Downloads/SSW%20Rules.png',
    show_preview_links: false,
    search: false,
    media_folder: 'static/assets',
    public_folder: '/assets',
    load_config_file: false,
    collections: [
      {
        name: 'rule',
        label: 'Rule',
        sortable_fields: [],
        folder: 'rules',
        media_folder: '',
        public_folder: '',
        slug: 'rule',
        path: '{{uri}}/rule',
        create: true,
        fields: [
          {
            name: 'type',
            label: 'Type(e.g.rule / category)',
            widget: 'hidden',
            default: 'rule',
          },
          { name: 'title', label: 'Title' },
          {
            name: 'uri',
            label: 'uri (a unique identifier for the url)',
            pattern: [
              '^[a-z0-9_-]*$',
              'Must only contain lowercase alphanumeric or the "-" and "_" characters',
            ],
          },
          {
            name: 'body',
            label: 'Body',
            widget: 'markdown',
            default: `Instructions for creating rules can be found at [How to Create Rules](https://github.com/SSWConsulting/SSW.Rules.Content/wiki/How-to-Create-Rules). Follow the steps below and replace the text in this box with your own content.
            
1. Place your intro here. This will show in the blurb.
            
<!--endintro-->

2. Place your content here. Markdown is your friend. See this [example rule](https://www.ssw.com.au/rules/rule) for all the things you can do with Rules.
3. Submit your rule for review.
4. Add your rule to a category. See [How to Add and Edit Categories and Top Categories](https://github.com/SSWConsulting/SSW.Rules.Content/wiki/How-to-Add-and-Edit-Categories-and-Top-Categories).`,
          },
          {
            name: 'authors',
            label: 'Acknowledgements',
            widget: 'list',
            fields: [
              { name: 'title', label: 'Name' },
              { name: 'url', label: 'Profile url', required: false },
              { name: 'img', label: 'Profile image', required: false },
            ],
            default: [{ title: '' }],
          },
          {
            name: 'related',
            label: 'Related',
            required: false,
            widget: 'list',
            field: {
              name: 'relatedRule',
              label: 'Rule uri',
              hint: 'The URI for the related rule, i.e. label-your-assets',
              pattern: [
                '^[a-z0-9_-]*$',
                'Must only contain lowercase alphanumeric or the "-" and "_" characters',
              ],
            },
          },
          {
            name: 'redirects',
            label: 'Redirects',
            required: false,
            widget: 'list',
            field: {
              name: 'redirectUri',
              label: 'Redirect uri',
              hint: 'The URI for the old rule, i.e. label-your-assets',
            },
          },
          {
            name: 'created',
            label: 'Date created',
            widget: 'datetime',
            field: {
              name: 'relatedRule',
              label: 'Rule',
              widget: 'relation',
              collection: 'rules',
              search_fields: ['title'],
              value_field: 'uri',
              display_fields: ['title'],
              options_length: 5,
            },
          },
          {
            name: 'archivedreason',
            label:
              'Archive this rule by adding a reason (leave blank to unarchive)',
            required: false,
          },
          {
            name: 'guid',
            label: 'GUID',
            widget: 'hidden',
            pattern: [
              '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
              'Must be a valid GUID',
            ],
            default: generateGuid(),
          },
        ],
      },
    ],
  },
};

export default configJson;
