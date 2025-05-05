import { Template } from 'tinacms';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import React from 'react';

export function EmailTemplate({ data }: { data: any }) {
  return (
    <div className="bg-gray-100 p-6 rounded-md space-y-4">
      <div className="space-y-3">
        {[
          { label: 'To', value: data.to },
          { label: 'Cc', value: data.cc },
          { label: 'Bcc', value: data.bcc },
          { label: 'Subject', value: data.subject },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-start text-right">
            <div className="w-24 pt-2 pr-2">{label}:</div>
            <div className="flex-1">
              <div className="bg-white border px-3 py-2 rounded text-sm min-h-[40px] flex items-center">
                {value || <span className="text-gray-400 italic">Empty</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="bg-white border p-4 rounded">
          <div className="prose prose-sm">
            <TinaMarkdown content={data.body} />
          </div>
        </div>
      </div>
    </div>
  );
}

export const emailBlockSchema: Template = {
  name: 'emailTemplate',
  label: 'Email Template',
  ui: {
    previewSrc: '/blocks/email-template.jpg',
    defaultItem: {
      to: 'XXX',
      cc: 'YYY',
      bcc: 'ZZZ',
      subject: '{{ Email Subject }}',
      body: {
        type: 'root',
        children: [
          {
            type: 'h2',
            children: [{ text: 'Hi XXX' }],
          },
          {
            type: 'p',
            children: [{ text: '{{ EMAIL CONTENT }}' }],
          },
        ],
      },
    },
  },
  fields: [
    { name: 'to', label: 'To', type: 'string' },
    { name: 'cc', label: 'Cc', type: 'string' },
    { name: 'bcc', label: 'Bcc', type: 'string' },
    { name: 'subject', label: 'Subject', type: 'string' },
    { name: 'body', label: 'Body', type: 'rich-text' },
  ],
};
