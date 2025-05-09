"use client";

import { embedComponents } from "@/components/embeds";
import { RuleQueryProps } from "@/models/RuleQueryProps";
import { tinaField, useTina } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";

export interface ClientRulePageProps {
  ruleQueryProps: RuleQueryProps;
}

export default function ClientRulePage(props: ClientRulePageProps) {
  const { ruleQueryProps } = props;

  const ruleData = useTina({
    query: ruleQueryProps.query,
    variables: ruleQueryProps.variables,
    data: ruleQueryProps.data,
  }).data;

  const rule = ruleData.rule;

  return (
    <>
      <h1 className="font-bold mb-4" data-tina-field={tinaField(rule, "title")}>
        {rule.title}
      </h1>
      <br />
      <TinaMarkdown data-tina-field={tinaField(rule,'content')} content={rule.content} components={embedComponents} />
    </>
  );
}
