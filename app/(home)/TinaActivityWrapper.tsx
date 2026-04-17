"use client";

import { useMemo } from "react";
import { useTina } from "tinacms/dist/react";
import ActivityRulesView from "@/components/ActivityRulesView";
import HomepageHeader from "@/components/HomepageHeader";
import { extractBodyPreview } from "@/lib/bodyUtils";
import { ActivityRule } from "@/models/ActivityRule";
import { RecentComment } from "@/models/RecentComment";

interface TinaQueryProps {
  query: string;
  variables: any;
  data: any;
}

export type TinaActivityWrapperProps = {
  rules: ActivityRule[];
  total: number;
  recentComments: RecentComment[];
  latestRulesData: ActivityRule[];
  ruleCount: number;
  tinaQueryProps: TinaQueryProps;
  activityRulesTinaProps: TinaQueryProps;
  latestRulesTinaProps: TinaQueryProps;
};

/**
 * Builds a guid → Tina node map from a ruleConnection response,
 * used to overlay live Tina edits onto static ActivityRule data.
 */
function buildTinaRuleMap(data: any): Map<string, any> {
  const map = new Map<string, any>();
  const edges = data?.ruleConnection?.edges ?? [];
  for (const edge of edges) {
    const node = edge?.node;
    if (node?.guid) {
      map.set(node.guid, node);
    }
  }
  return map;
}

/**
 * Overlays live Tina CMS data onto static ActivityRule objects.
 * GitHub-sourced fields (thumbsUp, commentCount, etc.) are preserved as-is.
 */
function applyTinaOverlay(rules: ActivityRule[], tinaMap: Map<string, any>): ActivityRule[] {
  return rules.map((rule) => {
    const live = tinaMap.get(rule.guid);
    if (!live) return rule;

    const authors = (live.authors ?? [])
      .map((a: any) => a?.title)
      .filter((t: string | undefined): t is string => !!t);

    const categories = (live.categories ?? [])
      .map((c: any) => {
        const cat = c?.category;
        if (cat && "title" in cat && cat.title) {
          return { title: cat.title, uri: ("uri" in cat ? (cat.uri as string) : null) ?? "" };
        }
        return null;
      })
      .filter((c: { title: string; uri: string } | null): c is { title: string; uri: string } => !!c);

    return {
      ...rule,
      title: live.title ?? rule.title,
      uri: live.uri ?? rule.uri,
      authors: authors.length > 0 ? authors : rule.authors,
      created: live.created ?? rule.created,
      lastUpdated: live.lastUpdated ?? rule.lastUpdated,
      descriptionPreview: extractBodyPreview(live.body) || rule.descriptionPreview,
      categories: categories.length > 0 ? categories : rule.categories,
    };
  });
}

export function TinaActivityWrapper({
  rules,
  total,
  recentComments,
  latestRulesData,
  ruleCount,
  tinaQueryProps,
  activityRulesTinaProps,
  latestRulesTinaProps,
}: TinaActivityWrapperProps) {
  const { data: homepageData } = useTina({
    query: tinaQueryProps.query,
    variables: tinaQueryProps.variables,
    data: tinaQueryProps.data,
  });

  const { data: activityRulesTinaData } = useTina({
    query: activityRulesTinaProps.query,
    variables: activityRulesTinaProps.variables,
    data: activityRulesTinaProps.data,
  });

  const { data: latestRulesTinaData } = useTina({
    query: latestRulesTinaProps.query,
    variables: latestRulesTinaProps.variables,
    data: latestRulesTinaProps.data,
  });

  const homepage = homepageData?.homepage;

  // Build maps of guid → live Tina node for overlay + click-to-edit
  const activityTinaMap = useMemo(() => buildTinaRuleMap(activityRulesTinaData), [activityRulesTinaData]);
  const latestTinaMap = useMemo(() => buildTinaRuleMap(latestRulesTinaData), [latestRulesTinaData]);

  // Overlay live Tina edits onto the activity rules (GitHub metrics stay static)
  const liveActivityRules = useMemo(() => applyTinaOverlay(rules, activityTinaMap), [rules, activityTinaMap]);

  // Overlay live Tina edits onto the latest rules
  const liveLatestRules = useMemo(() => applyTinaOverlay(latestRulesData, latestTinaMap), [latestRulesData, latestTinaMap]);

  // Merged map for click-to-edit (both datasets share the same card component)
  const tinaNodeMap = useMemo(() => {
    const merged = new Map<string, any>();
    for (const [k, v] of activityTinaMap) merged.set(k, v);
    for (const [k, v] of latestTinaMap) merged.set(k, v);
    return merged;
  }, [activityTinaMap, latestTinaMap]);

  return (
    <>
      <HomepageHeader homepage={homepage} ruleCount={ruleCount} />
      <ActivityRulesView
        rules={liveActivityRules}
        total={total}
        recentComments={recentComments}
        latestRulesData={liveLatestRules}
        homepage={homepage}
        tinaNodeMap={tinaNodeMap}
      />
    </>
  );
}
