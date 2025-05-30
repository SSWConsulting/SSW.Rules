"use client";

import { embedComponents } from "@/components/embeds";
import { typographyComponents } from "@/components/typography-components";
import { Card } from "@/components/ui/card";
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
      <div className="flex gap-8">
        <Card dropShadow className="flex-2">
          <h1
            className="text-[#CC4141] text-4xl leading-[1.2] mt-0 b-4 font-semibold"
            data-tina-field={tinaField(rule, "title")}
          >
            {rule?.title}
          </h1>
          <p className="border-b-2 pb-4 mt-4">
            Updated by <b>XXX</b> 8 months ago.{" "}
            <a href="https://www.ssw.com.au/rules/rule">See history</a>
          </p>
          <div data-tina-field={tinaField(rule, "body")}>
            <TinaMarkdown
              content={rule.body}
              components={{
                ...embedComponents,
                ...typographyComponents,
              }}
            />
          </div>
        </Card>
        <div className="flex flex-col flex-1 gap-8">
          <Card>categories</Card>
          <Card>acknowledgements</Card>
          <Card>related rules</Card>
        </div>
      </div>
    </>
  );
}
