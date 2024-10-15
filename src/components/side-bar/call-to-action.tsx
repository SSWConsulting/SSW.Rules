import React from 'react';
import Contact from '../contact/contact';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTwitter } from '@fortawesome/free-brands-svg-icons';
import { Template } from 'tinacms';

export const CallToActionBlock = () => {
  // TODO: Migrate to use Rich-text and add TinaCMS params
  return (
    <section>
      <section>
        {/* TODO: Migrate to only Rich-Text? */}
        <Contact />
        <h4>About SSW</h4>
        <p>
          SSW Consulting has over 30 years of experience developing awesome
          Microsoft solutions that today build on top of Angular, React, Azure,
          Azure DevOps, SharePoint, Office 365, .NET Core, WebAPI, Dynamics 365,
          and SQL Server. With 40+ consultants in 5 countries, we have delivered
          the best in the business to more than 1,000 clients in 15 countries.
        </p>
      </section>
      <section>
        <h4>Join the conversation</h4>
        <div className="sidebar-spacing ">
          <a
            href="https://twitter.com/intent/tweet?button_hashtag=SSWRules&ref_src=twsrc%5Etfw"
            className="button twitter-hashtag-button"
            style={{ margin: 'auto' }}
          >
            <FontAwesomeIcon icon={faTwitter} />
            Tweet #SSWRules
          </a>
        </div>
      </section>
    </section>
  );
};

export const callToActionBlock: Template = {
  label: 'Call to Action',
  name: 'callToAction',
  ui: {
      previewSrc: '/img/blocks/call-to-action.png'
  },
  fields: [
      {
          type: 'string',
          name: 'label',
          label: 'Label',
          required: true
      },
     {
          type: 'rich-text',
          name: 'blurb',
          label: 'Blurb',
          required: true,
          templates: [
              {
                  name: 'button',
                  label: 'Button',
                  fields: [
                      {
                          type: 'string',
                          name: 'label',
                          label: 'Label',
                          required: true
                      },
                      {
                          type: 'string',
                          name: 'url',
                          label: 'URL',
                          required: true
                      }
                  ]
              }
          ]
     }
  ]
}
