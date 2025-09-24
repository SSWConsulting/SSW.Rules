"use client";

import { Card } from "@/components/ui/card";
import { LatestRule } from "@/models/LatestRule";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/dateUtils";
import { RiTimeFill } from "react-icons/ri";
import Spinner from "./Spinner";
import React, { useState, useTransition } from "react";

interface LatestRulesProps {
  rules: LatestRule[];
}

export default function LatestRulesCard({ rules }: LatestRulesProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSeeMore = (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading || isPending) return;
    setLoading(true);
    // Start a React transition; isPending will remain true until navigation completes
    startTransition(() => {
      router.push("/latest-rules/?size=50");
    });
  };

  return (
    <Card title="Latest Rules">
      {rules.map((rule, index) => (
        <ul key={index} className="ps-4 p-0 m-0">
          <li className="relative mb-2">
            <a href={`/${rule?.uri}`}>{rule?.title}</a>
            {rule?.lastUpdated && (
              <p className="text-xs text-gray-400 mt-1">
                <RiTimeFill className="inline mr-2"></RiTimeFill>
                {timeAgo(rule?.lastUpdated)}
              </p>
            )}
          </li>
        </ul>
      ))}

      <div>
        <button
          onClick={handleSeeMore}
          disabled={loading || isPending}
          className={`px-4 py-2 rounded-md inline-flex items-center ${loading || isPending ? 'text-gray-500' : 'text-ssw-red cursor-pointer hover:underline'}`}
        >
          {(loading || isPending) ? <Spinner size="sm" inline className="mr-2" /> : null}
          <span>{(loading || isPending) ? "Loading..." : "See More"}</span>
        </button>
      </div>
    </Card>
  );
}
