import Giscus from '@giscus/react';

export default function Discussion({ruleGuid}: {ruleGuid: string}) {
  return (
    <Giscus
        repo={`${process.env.NEXT_PUBLIC_GITHUB_ORG}/${process.env.NEXT_PUBLIC_GISCUS_REPO_NAME}`}
        repoId={process.env.NEXT_PUBLIC_GISCUS_REPO_ID || ''}
        categoryId={process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID || ''}
        mapping="specific"
        term={ruleGuid}
        strict="1"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="top"
        theme={process.env.NEXT_PUBLIC_GISCUS_THEME_URL || ''}
        lang="en"
        loading="lazy"
    />
  );
}