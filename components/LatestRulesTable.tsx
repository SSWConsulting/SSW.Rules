"use client";

import Link from "next/link";
import { LatestRule } from "@/models/LatestRule";
import { timeAgo } from "@/lib/dateUtils";
import { useState } from "react";
import { CgSortAz } from "react-icons/cg";
import { RiTimeFill } from "react-icons/ri";
import { Card } from "./ui/card";
import Dropdown from "./ui/dropdown";

interface LatestRulesTableProps {
  rulesByUpdated: LatestRule[];
  rulesByCreated: LatestRule[];
  title?: string;
}

export default function LatestRulesTable({
  rulesByUpdated,
  rulesByCreated,
  title,
}: LatestRulesTableProps) {
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
    { value: "created", label: "Recently Created" },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        {title && <h3 className="m-0 text-ssw-red font-bold">{title}</h3>}
        <div className="flex items-center space-x-2">
          <CgSortAz className="inline" size={24} />
          <Dropdown
            options={sortOptions}
            value={currentSort}
            onChange={(value) =>
              handleSortChange(value as "lastUpdated" | "created")
            }
          />
        </div>
      </div>

      {currentRules.map((rule, index) => (
        <Card className="mb-4" key={rule.id}>
          <div className=" flex">
            <span className="text-gray-500 mr-2">#{index + 1}</span>
            <div className="flex flex-col">
              <Link href={`/${rule.uri}`} className="no-underline">
                <h2 className="m-0 mb-2 text-2xl max-sm:text-lg hover:text-ssw-red">
                  {rule.title}
                </h2>
              </Link>
              <h4 className="flex m-0 text-lg max-sm:text-md">
                <span className="font-medium"> {rule.lastUpdatedBy}</span>
                {rule.lastUpdated ? (
                  <div className="flex items-center ml-4 text-gray-500 font-light">
                    <RiTimeFill className="inline mr-1" />
                    <span>{timeAgo(rule.lastUpdated)}</span>
                  </div>
                ) : (
                  ""
                )}
              </h4>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
