"use client";

import { Rule } from "@/tina/__generated__/types";
import { TinaMarkdown } from "tinacms/dist/rich-text";

export interface ClientRulePageProps {
  rule: Rule;
}

export default function ClientRulePage(props: ClientRulePageProps) {
  const { rule } = props;
  return (
    <>
      <h1>
        <b>{rule.title}</b>
      </h1>
      <br />
      <TinaMarkdown content={rule.content} />
    </>
  );
}
