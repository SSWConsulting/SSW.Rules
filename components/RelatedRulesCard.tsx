"use client";

import { Rule } from "@/types";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export type RelatedRule = { uri: string; title: string };

interface RelatedRulesCardProps {
  relatedRules?: Rule[] | null;
  emptyText?: string;
  className?: string;
}

const RelatedRulesCard = ({ relatedRules, emptyText = "No related rules.", className }: RelatedRulesCardProps) => {
  const relatedRulesMapping = (): RelatedRule[] => {
    const nodes = (relatedRules || [])
      .map((r: any) => r?.rule)
      .filter(
        (n: any): n is { uri: string; title: string } =>
          n && typeof n === "object" && typeof n.uri === "string" && typeof n.title === "string"
      );
  
    const byUri = new Map<string, { uri: string; title: string }>();
    for (const n of nodes) {
      if (!byUri.has(n.uri)) byUri.set(n.uri, { uri: n.uri, title: n.title });
    }
  
    return Array.from(byUri.values());
  };

  const mapped = relatedRulesMapping();

  if (!mapped || mapped.length === 0) {
    return <></>;
  }

  return (
    <Card title="Related rules">
      <ul className={className ?? "pl-4"}>
        {mapped.map((rule) => (
          <li key={rule.uri} className="not-last:mb-2">
            <Link href={`/${rule.uri}`} className="no-underline">
              {rule.title}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default RelatedRulesCard;

