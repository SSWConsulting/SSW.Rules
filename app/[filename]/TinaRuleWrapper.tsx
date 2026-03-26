"use client";

import { RefObject, useRef } from "react";
import { useTina } from "tinacms/dist/react";
import { useMarkHighlight } from "@/lib/useMarkHighlight";
import ServerRulePage, { ServerRulePageProps } from "./ServerRulePage";

export type TinaRuleProps = {
  serverRulePageProps: ServerRulePageProps;
  tinaQueryProps: any;
};

export function TinaRuleWrapper({ serverRulePageProps, tinaQueryProps }: TinaRuleProps) {
  const { data } = useTina({
    query: tinaQueryProps.query,
    variables: tinaQueryProps.variables,
    data: tinaQueryProps.data,
  });

  const contentRef = useRef<HTMLDivElement>(null);
  useMarkHighlight(contentRef as RefObject<HTMLElement>);

  return (
    <div ref={contentRef}>
      <ServerRulePage tinaProps={{ data }} serverRulePageProps={serverRulePageProps} />
    </div>
  );
}
