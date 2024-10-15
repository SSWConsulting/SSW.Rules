import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuoteLeft, faQuoteRight } from '@fortawesome/free-solid-svg-icons';
import { Template } from 'tinacms';

export const HistoryOfRulesBlock = ({ label, improveOurRulesQuoteBlock }) => {
  // TODO: Migrate to use Rich-text and add TinaCMS params
  return (
    <section id="history-of-rules">
      <section id="why-all-these-rules">
        <h4>{label}</h4>
        {/* TODO: Move to Rich-Text */}
        <p>
          Read about the{' '}
          <a
            href="https://www.codemag.com/article/0605091"
            target="_blank"
            rel="noopener noreferrer"
          >
            History of SSW Rules
          </a>
          , published in CoDe Magazine.
        </p>
      </section>
      <section id="help-improve-our-rules">
        <div className="testimonial text-center rounded p-3">
          <h4>{improveOurRulesQuoteBlock.label}</h4>
          {/* TODO: Move to Rich-Text */}
          <blockquote>
            <FontAwesomeIcon icon={faQuoteLeft} /> The SSW Rules website works
            just like Wikipedia. If you think something should be changed, hit
            the pencil icon and make an edit! Or if you are cool{' '}
            <a href="https://twitter.com/adamcogan">tweet me</a>
            <FontAwesomeIcon icon={faQuoteRight} />
          </blockquote>
          <div className="avatar">
            <img
              className="inline rounded-full"
              src={improveOurRulesQuoteBlock.quoteAuthorImage}
              alt={improveOurRulesQuoteBlock.quoteAuthorName}
            />
          </div>
          <div className="text-xl">
            <a
              href={improveOurRulesQuoteBlock.quoteAuthorUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {improveOurRulesQuoteBlock.quoteAuthorName}
            </a>
          </div>
          <div className="text-base">{improveOurRulesQuoteBlock.quoteAuthorTitle}</div>
        </div>
      </section>
    </section>
  );
};

export const historyOfRulesBlock: Template = {
  label: 'History of Rules',
  name: 'historyOfRules',
  ui: {
      defaultItem: {
          label: 'History of Rules',
          improveOurRulesQuoteBlock: {
              label: 'Help improve our Rules',
          }
      },
      previewSrc: '/img/blocks/history-of-rules.png'
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
          required: true
      },
      {
          type: 'object',
          name: 'improveOurRulesQuoteBlock',
          label: 'Improve Our Rules',
          fields: [
              {
                  type: 'string',
                  name: 'label',
                  label: 'Label',
                  required: true
              },
              {
                  type: 'rich-text',
                  name: 'quote',
                  label: 'Quote',
                  required: true
              },
              {
                  type: 'image',
                  name: 'quoteAuthorImage',
                  label: 'Quote Author Image',
                  required: true
              },
              {
                  type: 'string',
                  name: 'quoteAuthorName',
                  label: 'Quote Author Name',
                  required: true
              },
              {
                  type: 'string',
                  name: 'quoteAuthorUrl',
                  label: 'Quote Author Url',
                  description: 'URL to the quote author\'s website/People Page',
                  required: true
              },
              {
                  type: 'string',
                  name: 'quoteAuthorTitle',
                  label: 'Quote Author Title',
                  required: true
              }
          ]
      }
  ]
}

