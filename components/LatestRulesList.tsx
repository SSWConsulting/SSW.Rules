"use client";

import { LatestRule } from "@/models/LatestRule";
import { useState } from "react";
import { CgSortAz } from "react-icons/cg";
import Dropdown from "./ui/dropdown";
import RuleCard from "./RuleCard";

interface LatestRulesListProps {
  rulesByUpdated: LatestRule[];
  rulesByCreated: LatestRule[];
  title?: string;
}

export default function LatestRulesList({
  rulesByUpdated,
  rulesByCreated,
  title,
}: LatestRulesListProps) {
  const [currentSort, setCurrentSort] = useState<"lastUpdated" | "created">(
    "lastUpdated"
  );

  const handleSortChange = (newSort: "lastUpdated" | "created") => {
    setCurrentSort(newSort);
  };

  const currentRules =
    currentSort === "lastUpdated" ? rulesByUpdated : rulesByCreated;

  const sortOptions = [
    { value: "lastUpdated", label: "Last Updated" },
    { value: "created", label: "Recently Created" }
  ];

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        {title && <h2 className="m-0 text-ssw-red font-bold">{title}</h2>}
        <div className="flex items-center space-x-2">
          <CgSortAz className="inline" size={24} />
          <Dropdown
            options={sortOptions}
            value={currentSort}
            onChange={(value) => handleSortChange(value as "lastUpdated" | "created")}
          />
        </div>
      </div>

      {currentRules.map((rule, index) => (
        <RuleCard
          key={rule.id}
          title={rule.title}
          slug={rule.uri}
          lastUpdatedBy={rule.lastUpdatedBy}
          lastUpdated={rule.lastUpdated}
          authorUrl={rule.authorUrl}
          index={index}
        />
      ))}
    </div>
  );
}
