function generateGuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
var configJson = {
  config: {
    backend: {
      name: 'github',
      repo: 'SSWConsulting/SSW.Rules.Content',
      branch: 'staging',
      open_authoring: true,
      auth_endpoint: '/api/auth',
      always_fork: true,
      base_url: process.env.API_BASE_URL,
    },
    site_url: 'https://www.ssw.com.au/rules',
    publish_mode: 'editorial_workflow',
    logo_url:
      'https://www.ssw.com.au/ssw/logo/SSWRules/Downloads/SSW%20Rules.png',
    show_preview_links: false,
    search: false,
    media_folder: 'static/assets',
    public_folder: '/assets',
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
              '^[a-zA-Z0-9_-]*$',
              "Must only contain alphanumeric or the '-' and '_' characters",
            ],
          },
          {
            name: 'body',
            label: 'Body',
            widget: 'markdown',
            default:
              'Markdown shown in the blurb.<br><!--endintro--><br>Markdown not shown in the blurb',
          },
          {
            name: 'authors',
            label: 'Authors',
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
              pattern: [
                '^[a-zA-Z0-9_-]*$',
                "Must only contain alphanumeric or the '-' and '_' characters",
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
              pattern: [
                '^[a-zA-Z0-9_-]*$',
                "Must only contain alphanumeric or the '-' and '_' characters",
              ],
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
            label: 'Archived Reason (leave blank if none)',
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