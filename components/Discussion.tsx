"use client";

import Giscus from "@giscus/react";

const isDev = process.env.NODE_ENV === "development";

export default function Discussion({ ruleGuid, discussionNumber }: { ruleGuid: string; discussionNumber?: number | null }) {
  if (isDev || !ruleGuid) {
    return <></>;
  }

  // Prefer mapping by discussion number: it is resolved server-side from the
  // discussions API and does not depend on GitHub's discussion search index,
  // which has been returning nothing for the content repo (SSW.Rules#2765).
  // Fall back to the GUID when a rule has no discussion yet, so giscus can
  // still create one on the first comment.
  const mapping = discussionNumber
    ? ({ mapping: "number", term: String(discussionNumber) } as const)
    : ({ mapping: "specific", term: ruleGuid, strict: "1" } as const);

  return (
    <Giscus
      repo={`${process.env.NEXT_PUBLIC_GITHUB_ORG}/${process.env.NEXT_PUBLIC_GISCUS_REPO_NAME}`}
      repoId={process.env.NEXT_PUBLIC_GISCUS_REPO_ID || ""}
      categoryId={process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID || ""}
      {...mapping}
      reactionsEnabled="1"
      emitMetadata="0"
      inputPosition="top"
      theme={process.env.NEXT_PUBLIC_GISCUS_THEME_URL || ""}
      lang="en"
      loading="lazy"
    />
  );
}
