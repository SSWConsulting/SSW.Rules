export interface HomepageData {
  tagline?: string;
  aboutSsw?: {
    title?: string;
    body?: string;
  };
  needHelp?: {
    title?: string;
    description?: string;
    buttonText?: string;
    jotFormId?: string;
  };
  helpImprove?: {
    title?: string;
    quote?: string;
    tweetUrl?: string;
    personName?: string;
    personTitle?: string;
    personImage?: string;
    personProfileUrl?: string;
  };
  whyRules?: {
    title?: string;
    description?: string;
    linkText?: string;
    linkUrl?: string;
  };
  joinConversation?: {
    hashtag?: string;
    platformUrl?: string;
  };
}
