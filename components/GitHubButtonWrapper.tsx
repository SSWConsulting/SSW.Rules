"use client";

import GitHubButton from 'react-github-btn';

export const GitHubButtonWrapper = () => {
  return (
    <GitHubButton
      href="https://github.com/SSWConsulting/SSW.Rules"
      data-size="large"
      data-show-count="true"
      aria-label="Star SSWConsulting/SSW.Rules on GitHub"
    >
      Star
    </GitHubButton>
  );
};