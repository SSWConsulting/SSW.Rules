"use client";

import { embedComponents } from "@/components/embeds";
import { tinaField, useTina } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";

export interface ClientRulePageProps {
  ruleQueryProps;
}

export default function ClientRulePage(props: ClientRulePageProps) {
  const { ruleQueryProps } = props;

  const ruleData = useTina({
    query: ruleQueryProps?.query,
    variables: ruleQueryProps?.variables,
    data: ruleQueryProps?.data,
  }).data;

  const rule = ruleData?.rule;

  return (
    <>
      <h1 className="font-bold mb-4" data-tina-field={tinaField(rule, "title")}>
        {rule?.title}
      </h1>
      <div data-tina-field={tinaField(rule, "body")}>
        <TinaMarkdown content={rule.body} components={embedComponents} />
      </div>
    </>
  );
}
